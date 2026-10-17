import { describe, expect, test } from 'bun:test';
import { buildAnswer, type AnswerData } from '../src/lib/server/ai/answer';
import { ask, unsupportedNumbers, type AskEvent } from '../src/lib/server/ai/assistant';
import {
	keywordIntent,
	mergeIntents,
	questionLanguage,
	validateIntent
} from '../src/lib/server/ai/intent';
import { parseTextToolCall, type LlmProvider, type ToolCall } from '../src/lib/server/ai/provider';
import type { AntibioticInfo, IsolateRecord, WardInfo } from '../src/lib/amr/types';
import { makeIsolate } from './helpers';

const ward = (code: string, nameEn: string, nameFi: string): WardInfo => ({
	code,
	nameEn,
	nameFi,
	type: 'in',
	institution: 'hospital'
});
const ab = (code: string, name: string, nameFi: string, reportedFor: 'all' | 'urine' = 'all') =>
	({ code, name, nameFi, class: 'x', reportedFor }) satisfies AntibioticInfo;

const CATALOG = {
	wards: [
		ward('ED', 'Emergency department', 'Päivystys'),
		ward('ICU', 'Intensive care unit', 'Teho-osasto'),
		ward('URO', 'Urology', 'Urologia')
	],
	antibiotics: [
		ab('NIT', 'nitrofurantoin', 'nitrofurantoiini', 'urine'),
		ab('MEC', 'mecillinam', 'mesillinaami', 'urine'),
		ab('CRO', 'ceftriaxone', 'keftriaksoni'),
		ab('CIP', 'ciprofloxacin', 'siprofloksasiini'),
		ab('TZP', 'piperacillin-tazobactam', 'piperasilliini-tatsobaktaami'),
		ab('MEM', 'meropenem', 'meropeneemi')
	],
	organisms: [
		'Escherichia coli',
		'Staphylococcus aureus',
		'Klebsiella pneumoniae',
		'Klebsiella oxytoca'
	],
	firstDate: '2024-01-01',
	lastDate: '2026-06-30'
};

describe('validateIntent', () => {
	test('accepts codes, names and synonyms, and maps ages to groups', () => {
		const { intent, dropped } = validateIntent(
			{
				type: 'therapy',
				ward: 'Urology',
				site: 'febrile-uti',
				sex: 'male',
				age: 78,
				antibiotic: 'Ceftriaxone'
			},
			CATALOG
		);
		expect(intent).toEqual({
			type: 'therapy',
			ward: 'URO',
			site: 'febrile-uti',
			sex: 'M',
			age: 'elderly',
			antibiotic: 'CRO'
		});
		expect(dropped).toEqual([]);
	});

	test('drops values that are not known codes instead of passing them on', () => {
		const { intent, dropped } = validateIntent(
			{
				type: 'forecast',
				ward: 'Cardiology',
				organism: 'Candida auris',
				antibiotic: 'colistin',
				date: '2031-01-01',
				specimen: null
			},
			CATALOG
		);
		expect(intent).toEqual({ type: 'resistance' });
		expect(dropped).toHaveLength(5);
	});

	test('resolves a genus to its most frequent species, and a species to itself', () => {
		expect(validateIntent({ organism: 'Klebsiella' }, CATALOG).intent.organism).toBe(
			'Klebsiella pneumoniae'
		);
		expect(validateIntent({ organism: 'K. oxytoca' }, CATALOG).intent.organism).toBe(
			'Klebsiella oxytoca'
		);
		expect(validateIntent({ organism: 'MRSA' }, CATALOG).intent.organism).toBe(
			'Staphylococcus aureus'
		);
	});

	test('ignores placeholder values from the model', () => {
		expect(validateIntent({ ward: 'null', organism: 'any' }, CATALOG).dropped).toEqual([]);
	});
});

describe('keywordIntent', () => {
	test('English resistance question', () => {
		expect(keywordIntent('How is Klebsiella resistance evolving in ICU?', CATALOG)).toEqual({
			type: 'resistance',
			ward: 'ICU',
			organism: 'Klebsiella pneumoniae'
		});
	});

	test('English therapy question with age, sex and febrile UTI', () => {
		expect(
			keywordIntent('What should I give a 78-year-old man with febrile UTI in Urology?', CATALOG)
		).toEqual({
			type: 'therapy',
			ward: 'URO',
			specimen: 'urine',
			site: 'febrile-uti',
			sex: 'M',
			age: 'elderly'
		});
	});

	test('French questions', () => {
		expect(keywordIntent('Y a-t-il des alertes en cours aux urgences ?', CATALOG)).toEqual({
			type: 'alerts',
			ward: 'ED'
		});
		expect(
			keywordIntent(
				'Comment évolue la résistance d’E. coli à la ceftriaxone dans le sang ?',
				CATALOG
			)
		).toEqual({
			type: 'resistance',
			organism: 'Escherichia coli',
			antibiotic: 'CRO',
			specimen: 'blood'
		});
		// "utiliser" must not be read as UTI.
		expect(keywordIntent('Peut-on utiliser la ciprofloxacine ?', CATALOG).specimen).toBeUndefined();
	});

	test('Finnish questions', () => {
		expect(
			keywordIntent(
				'Mitä antibioottia annan 70-vuotiaalle naiselle, jolla on kuumeinen virtsatieinfektio?',
				CATALOG
			)
		).toEqual({
			type: 'therapy',
			specimen: 'urine',
			site: 'febrile-uti',
			sex: 'F',
			age: 'elderly'
		});
		expect(keywordIntent('Onko teho-osastolla MRSA-rypäitä?', CATALOG)).toEqual({
			type: 'alerts',
			ward: 'ICU',
			organism: 'Staphylococcus aureus'
		});
	});

	test('model fields override keywords, keywords fill the gaps', () => {
		expect(
			mergeIntents({ type: 'resistance', ward: 'URO' }, { type: 'alerts', organism: 'X' })
		).toEqual({ intent: { type: 'resistance', ward: 'URO', organism: 'X' }, ungrounded: [] });
	});

	test('filters the question does not mention are dropped from the model intent', () => {
		const { intent, ungrounded } = mergeIntents(
			{ type: 'resistance', ward: 'ICU', antibiotic: 'AMP', asOf: '2025-01-01' },
			{ type: 'resistance', ward: 'ICU' }
		);
		expect(intent).toEqual({ type: 'resistance', ward: 'ICU' });
		expect(ungrounded).toEqual(['antibiotic: AMP', 'asOf: 2025-01-01']);
	});
});

/** 40 E. coli urine isolates in URO per year: CRO 90 % S the previous 12 months, 70 % the last 12. */
function dataset(): AnswerData {
	const month = (start: number, i: number) => {
		const m = start + (i % 12);
		return `${2024 + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, '0')}-10`;
	};
	const isolates: IsolateRecord[] = [];
	for (const [start, susceptible] of [
		[7, 36], // 2024-07 → 2025-06
		[19, 28] // 2025-07 → 2026-06
	]) {
		for (let i = 0; i < 40; i++) {
			isolates.push(
				makeIsolate({
					patientId: `P-${start}-${i}`,
					date: month(start, i),
					ward: 'URO',
					specimen: 'urine',
					results: { CRO: i < susceptible ? 'S' : 'R', MEM: 'S', NIT: 'S' }
				})
			);
		}
	}
	return { ...CATALOG, isolates };
}

describe('buildAnswer', () => {
	const data = dataset();

	test('resistance: every figure is computed from first isolates', () => {
		const answer = buildAnswer(
			{ type: 'resistance', ward: 'URO', organism: 'Escherichia coli', antibiotic: 'CRO' },
			data
		);
		const drugs = answer.facts.percentSusceptible as {
			code: string;
			last12Months: { pct: number; n: number };
			previous12Months: { pct: number; n: number };
		}[];
		expect(drugs).toHaveLength(1);
		expect(drugs[0].last12Months).toEqual({ pct: 70, n: 40 });
		expect(drugs[0].previous12Months).toEqual({ pct: 90, n: 40 });
		expect(answer.summary).toContain(
			'ceftriaxone: 30 % resistant / 70 % susceptible (n = 40) over the last 12 months; 10 % resistant / 90 % susceptible (n = 40) the 12 months before → resistance UP 20 points;'
		);
		expect(answer.facts.specimen).toBe('all');
		expect(answer.link).toMatchObject({ route: '/antibiogram' });
		expect(answer.link.query).toBe('ward=URO&specimen=urine&organism=Escherichia+coli&ab=CRO');
		expect(answer.facts.monthlyPercentSusceptible).toHaveLength(12);
	});

	test('resistance without a drug highlights the largest fall', () => {
		const answer = buildAnswer({ type: 'resistance', ward: 'URO' }, data);
		expect(answer.summary).toMatch(
			/^Escherichia coli, URO \(Urology\), all specimens: 40 first isolates/
		);
		expect(answer.summary).toContain('ceftriaxone: 30 % resistant');
	});

	test('therapy: narrowest drug reaching 80 %, with an advisor link', () => {
		const answer = buildAnswer({ type: 'therapy', ward: 'URO', site: 'cystitis' }, data);
		expect(answer.facts.recommended).toEqual({
			antibiotic: 'nitrofurantoin',
			coverage: { pct: 100, n: 40 }
		});
		expect(answer.link).toEqual({
			route: '/advisor',
			query: 'ward=URO&site=cystitis',
			label: 'Open the therapy advisor'
		});
	});

	test('therapy for febrile UTI excludes lower-UTI-only agents', () => {
		const answer = buildAnswer({ type: 'therapy', ward: 'URO', site: 'febrile-uti' }, data);
		expect((answer.facts.recommended as { antibiotic: string }).antibiotic).toBe('meropenem');
	});

	test('alerts: none in quiet data', () => {
		const answer = buildAnswer({ type: 'alerts', ward: 'URO' }, data);
		expect(answer.summary).toBe('No active alert in URO (Urology) for the 4 weeks to 2026-06-30.');
		expect(answer.link.route).toBe('/alerts');
	});
});

describe('questionLanguage', () => {
	test('detects English, French and Finnish', () => {
		expect(questionLanguage('How is Klebsiella resistance evolving in ICU?')).toBe('English');
		expect(questionLanguage('Y a-t-il des alertes en cours aux urgences ?')).toBe('French');
		expect(questionLanguage('Comment évolue la résistance ?')).toBe('French');
		expect(questionLanguage('Onko teho-osastolla MRSA-rypäitä?')).toBe('Finnish');
	});
});

describe('parseTextToolCall', () => {
	const tools = ['resistance', 'therapy', 'alerts'];
	test('recovers a call written in prose', () => {
		expect(
			parseTextToolCall(
				'You can call the `resistance` function:\n```\nresistance(organism: "Klebsiella pneumoniae", ward: "ICU")\n```',
				tools
			)
		).toEqual({
			name: 'resistance',
			arguments: { organism: 'Klebsiella pneumoniae', ward: 'ICU' }
		});
	});
	test('recovers a JSON call and ignores unknown tools', () => {
		expect(parseTextToolCall('{"name": "alerts", "arguments": {"ward": "ED"}}', tools)).toEqual({
			name: 'alerts',
			arguments: { ward: 'ED' }
		});
		expect(parseTextToolCall('delete_all(ward: "ICU")', tools)).toBeNull();
	});
});

describe('unsupportedNumbers', () => {
	test('flags figures that are not in the data', () => {
		const facts = { pct: 70, n: 40, text: 'previous 90 %' };
		expect(unsupportedNumbers('Susceptibility fell to 70 % (n=40) from 90 %.', facts)).toEqual([]);
		expect(unsupportedNumbers('Susceptibility fell to 65 %.', facts)).toEqual(['65']);
	});
});

class MockProvider implements LlmProvider {
	readonly backend = 'mock';
	prompts: string[] = [];
	constructor(
		readonly model: string,
		private readonly tools: boolean,
		private readonly reply: { tool?: ToolCall; json?: unknown; text?: string; fail?: boolean }
	) {}
	async supportsTools() {
		if (this.reply.fail) throw new TypeError('fetch failed');
		return this.tools;
	}
	async ping() {
		return !this.reply.fail;
	}
	async callTool() {
		return this.reply.tool ?? null;
	}
	async json() {
		return this.reply.json;
	}
	async *stream(messages: { content: string }[]) {
		this.prompts.push(messages.map((m) => m.content).join('\n'));
		for (const word of (this.reply.text ?? '').split(' ')) yield `${word} `;
	}
}

async function collect(events: AsyncGenerator<AskEvent>) {
	const out: AskEvent[] = [];
	for await (const e of events) out.push(e);
	return out;
}

describe('ask', () => {
	const data = dataset();

	test('tool-calling model: tool arguments become the validated intent', async () => {
		const provider = new MockProvider('mistral', true, {
			tool: { name: 'resistance', arguments: { ward: 'URO', antibiotic: 'ceftriaxone' } },
			text: 'Ceftriaxone susceptibility fell from 90 % to 70 %.'
		});
		const events = await collect(ask('Is ceftriaxone still OK in urology?', data, provider));
		const intent = events.find((e) => e.type === 'intent');
		expect(intent).toMatchObject({ via: 'tools', intent: { ward: 'URO', antibiotic: 'CRO' } });
		expect(events.find((e) => e.type === 'check')).toEqual({ type: 'check', unsupported: [] });
		expect(events.at(-1)).toMatchObject({ type: 'done', model: 'mock · mistral' });
		// Only aggregates reach the model: no patient or isolate identifiers.
		expect(provider.prompts[0]).not.toMatch(/P-20\d\d|I\d{6}/);
	});

	test('model without tools: JSON intent path', async () => {
		const provider = new MockProvider('llama3', false, {
			json: { type: 'therapy', ward: 'URO', site: 'cystitis' },
			text: 'Nitrofurantoin covers 100 %.'
		});
		const events = await collect(ask('cystitis in urology?', data, provider));
		expect(events.find((e) => e.type === 'intent')).toMatchObject({
			via: 'json',
			intent: { type: 'therapy', ward: 'URO', site: 'cystitis' }
		});
	});

	test('model down: clear error, keyword intent and the computed answer still delivered', async () => {
		const provider = new MockProvider('mistral', true, { fail: true });
		const events = await collect(ask('How is E. coli doing in Urology?', data, provider));
		expect(events.map((e) => e.type)).toEqual(['error', 'intent', 'answer', 'done']);
		expect(events[0]).toMatchObject({
			message: expect.stringContaining('model server is not reachable')
		});
		expect(events[1]).toMatchObject({ via: 'keywords', intent: { ward: 'URO' } });
		expect(events.at(-1)).toMatchObject({ model: null });
	});
});
