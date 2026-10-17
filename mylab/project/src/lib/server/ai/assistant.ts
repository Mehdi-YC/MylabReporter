import { buildAnswer, type Answer, type AnswerData } from './answer';
import {
	intentPrompt,
	intentTools,
	keywordIntent,
	mergeIntents,
	questionLanguage,
	validateIntent,
	type Intent,
	type QuestionType
} from './intent';
import { AGE_GROUPS, SITES } from '#lib/amr/advisor.ts';
import type { ChatMessage, LlmProvider } from './provider';

/** How the question was turned into an intent. */
export type IntentSource = 'tools' | 'json' | 'keywords';

export type AskEvent =
	| { type: 'status'; message: string }
	| {
			type: 'intent';
			intent: Intent;
			via: IntentSource;
			dropped: string[];
			/** Fields taken from the page the question was asked on. */
			fromContext: ContextField[];
	  }
	| { type: 'answer'; answer: Answer }
	| { type: 'token'; text: string }
	| { type: 'check'; unsupported: string[] }
	| { type: 'error'; message: string }
	| { type: 'done'; model: string | null; ms: number };

/** CPU-only local models are slow: generous, but bounded. */
const INTENT_TIMEOUT_MS = 180_000;
const ANSWER_TIMEOUT_MS = 300_000;

const ANSWER_SYSTEM = [
	'You are the assistant of a hospital microbiology laboratory (Tyks, Turku, Finland).',
	'Rewrite FACTS as a short answer to the QUESTION, in the language of the QUESTION (English, French or Finnish), in at most 3 sentences.',
	'FACTS were computed from the laboratory data and are correct: keep their figures and their meaning exactly.',
	'Never invent, recompute or reinterpret numbers; "susceptible" and "resistant" are opposites, never swap them.',
	'Keep the "too few to be reliable" warnings attached to the figure they belong to. Do not mention links or FACTS.'
].join(' ');

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'TimeoutError') return 'the model did not answer in time';
		const cause = (error as Error & { cause?: { code?: string } }).cause;
		if (
			cause?.code === 'ECONNREFUSED' ||
			/fetch failed|ECONNREFUSED|Unable to connect/i.test(error.message)
		)
			return 'the model server is not reachable';
		return error.message;
	}
	return String(error);
}

/**
 * Numbers in the model's text that do not appear in the data or the question. Model-written
 * figures are a hallucination risk, so they are surfaced next to the answer.
 */
export function unsupportedNumbers(text: string, facts: unknown, question = ''): string[] {
	const known = new Set<string>();
	const collect = (value: unknown) => {
		if (typeof value === 'number') known.add(String(value));
		else if (typeof value === 'string')
			for (const m of value.match(/\d+(?:[.,]\d+)?/g) ?? []) known.add(m.replace(',', '.'));
		else if (value && typeof value === 'object') Object.values(value).forEach(collect);
	};
	collect(facts);
	collect(question);
	// Thresholds and constants quoted in the prompt rules.
	['30', '4', '12', '80', '100'].forEach((n) => known.add(n));
	const found = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
	return [...new Set(found.map((m) => m.replace(',', '.')))].filter(
		(n) => !known.has(n) && !known.has(String(Math.round(Number(n))))
	);
}

/**
 * Question → validated intent → deterministic answer → model-written wording.
 * The model never sees patient rows, only the computed summary of the aggregates; every number
 * in it comes from the surveillance functions. Without a model (or when it
 * fails) the deterministic answer is still complete.
 */
/**
 * What the user is looking at when asking: the page's filters (ward, date, specimen), the cell
 * they opened (organism × antibiotic) and, on the advisor, the patient profile.
 */
export interface AskContext {
	ward?: string;
	asOf?: string;
	specimen?: string;
	organism?: string;
	antibiotic?: string;
	site?: string;
	sex?: string;
	age?: string;
}
export type ContextField = keyof AskContext;

/** Page fields that make sense for each kind of question (ward and date apply to all). */
const CONTEXT_FIELDS: Record<QuestionType, ContextField[]> = {
	resistance: ['specimen', 'organism', 'antibiotic'],
	therapy: ['site', 'sex', 'age'],
	alerts: []
};

/** The page's value for a field, when it is a code the dataset knows. */
function contextValue(field: ContextField, context: AskContext, data: AnswerData): string | null {
	const v = context[field];
	if (!v) return null;
	const ok: Record<ContextField, () => boolean> = {
		ward: () => data.wards.some((w) => w.code === v),
		asOf: () => v >= data.firstDate && v <= data.lastDate,
		specimen: () => ['urine', 'blood', 'wound'].includes(v),
		organism: () => data.organisms.includes(v),
		antibiotic: () => data.antibiotics.some((a) => a.code === v),
		site: () => v in SITES,
		sex: () => v === 'F' || v === 'M',
		age: () => v in AGE_GROUPS
	};
	return ok[field]() ? v : null;
}

/** "In the whole hospital": the page's ward must not narrow the answer. */
const WHOLE_HOSPITAL =
	/all wards|whole hospital|hospital-wide|kaikki osastot|koko sairaala|kaikilla osastoilla|tous les services|tout l.h[oô]pital/i;

export async function* ask(
	question: string,
	data: AnswerData,
	provider: LlmProvider | null,
	context: AskContext = {}
): AsyncGenerator<AskEvent> {
	const started = Date.now();
	const keywords = keywordIntent(question, data);
	let intent = keywords;
	let via: IntentSource = 'keywords';
	let dropped: string[] = [];
	let model = provider;

	if (model) {
		try {
			const tools = await model.supportsTools();
			yield {
				type: 'status',
				message: tools
					? `${model.model} is choosing a query (tool calling)…`
					: `${model.model} is reading the question (JSON intent)…`
			};
			const signal = AbortSignal.timeout(INTENT_TIMEOUT_MS);
			let raw: unknown = null;
			if (tools) {
				const call = await model.callTool(
					[
						{
							role: 'system',
							content:
								'Call exactly one function to answer the clinical microbiology question. Only fill parameters the question mentions.'
						},
						{ role: 'user', content: question }
					],
					intentTools(data),
					signal
				);
				if (call) raw = { ...call.arguments, type: call.name };
			} else {
				raw = await model.json(
					[
						{ role: 'system', content: intentPrompt(data) },
						{ role: 'user', content: question }
					],
					signal
				);
			}
			if (raw) {
				const validated = validateIntent(raw, data);
				const merged = mergeIntents(validated.intent, keywords);
				intent = merged.intent;
				dropped = [
					...validated.dropped,
					...merged.ungrounded.map((f) => `${f} (not in the question)`)
				];
				via = tools ? 'tools' : 'json';
			}
		} catch (error) {
			yield {
				type: 'error',
				message: `Language model unavailable (${errorMessage(error)}): showing the computed answer only.`
			};
			model = null;
		}
	}
	// Fill what the question leaves open from the page it was asked on.
	const fromContext: ContextField[] = [];
	const fill = (field: ContextField) => {
		const value = contextValue(field, context, data);
		if (!value || intent[field] !== undefined) return;
		intent = { ...intent, [field]: value } as Intent;
		fromContext.push(field);
	};
	if (!WHOLE_HOSPITAL.test(question)) fill('ward');
	fill('asOf');
	for (const field of CONTEXT_FIELDS[intent.type]) {
		// The opened cell's drug belongs to its organism: not to another one the question names.
		if (field === 'antibiotic' && intent.organism && intent.organism !== context.organism) continue;
		fill(field);
	}
	yield { type: 'intent', intent, via, dropped, fromContext };

	const answer = buildAnswer(intent, data);
	yield { type: 'answer', answer };

	if (model) {
		yield { type: 'status', message: `${model.model} is writing the answer…` };
		const messages: ChatMessage[] = [
			{ role: 'system', content: ANSWER_SYSTEM },
			{
				role: 'user',
				// The computed summary only: the full facts confuse small models (and cost CPU time).
				content: `QUESTION: ${question}\n\nFACTS: ${answer.summary}\n\nAnswer in ${questionLanguage(question)}.`
			}
		];
		let text = '';
		try {
			for await (const chunk of model.stream(messages, AbortSignal.timeout(ANSWER_TIMEOUT_MS))) {
				text += chunk;
				yield { type: 'token', text: chunk };
			}
			yield {
				type: 'check',
				unsupported: unsupportedNumbers(text, [answer.summary, answer.facts], question)
			};
		} catch (error) {
			yield {
				type: 'error',
				message: `The model stopped (${errorMessage(error)}): the computed answer below is complete.`
			};
			model = null;
		}
	}
	yield {
		type: 'done',
		model: model ? `${model.backend} · ${model.model}` : null,
		ms: Date.now() - started
	};
}
