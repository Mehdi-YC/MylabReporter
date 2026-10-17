import { AGE_GROUPS, SITES, type AgeGroup, type Site } from '#lib/amr/advisor.ts';
import type { AntibioticInfo, Sex, Specimen, WardInfo } from '#lib/amr/types.ts';
import type { ToolSpec } from './provider';

/**
 * What a clinician asks, reduced to codes the deterministic layer understands. The model only
 * proposes an intent; every field is checked against the dataset's own codes before use.
 */
export const QUESTION_TYPES = ['resistance', 'therapy', 'alerts'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface Intent {
	type: QuestionType;
	ward?: string;
	specimen?: Specimen;
	organism?: string;
	/** WHONET antibiotic code. */
	antibiotic?: string;
	site?: Site;
	sex?: Sex;
	age?: AgeGroup;
	/** Reference date, ISO. */
	asOf?: string;
}

/** Codes the intent is validated against. */
export interface Catalog {
	wards: WardInfo[];
	antibiotics: AntibioticInfo[];
	/** Most frequent first: an ambiguous genus resolves to its commonest species. */
	organisms: string[];
	firstDate: string;
	lastDate: string;
}

const SPECIMENS: Specimen[] = ['urine', 'blood', 'wound'];
const SITE_KEYS = Object.keys(SITES) as Site[];

/** Lower case without diacritics, so "Päivystys" and "paivystys" match. */
export function normalize(text: string): string {
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * True when `alias` starts a word of `text` (Finnish and French inflect the end of words).
 * A trailing `$` asks for the whole word ("uti$" must not match "utiliser").
 */
function mentions(text: string, alias: string): boolean {
	const whole = alias.endsWith('$');
	const escaped = normalize(whole ? alias.slice(0, -1) : alias).replace(
		/[.*+?^${}()|[\]\\]/g,
		'\\$&'
	);
	return new RegExp(`(^|[^a-z0-9])${escaped}${whole ? '($|[^a-z0-9])' : ''}`).test(text);
}

const WARD_ALIASES: Record<string, string[]> = {
	ICU: ['intensive care', 'teho', 'reanimation', 'soins intensifs', 'tehohoito'],
	URO: ['urolog'],
	ED: ['emergency', 'paivystys', 'urgence'],
	SURG: ['surg', 'kirurg', 'chirurg'],
	GER: ['geriatr'],
	'MED-A': ['internal medicine a', 'medicine a', 'medecine interne a', 'sisataudit a'],
	'MED-B': ['internal medicine b', 'medicine b', 'medecine interne b', 'sisataudit b'],
	'PHC-N': ['health centre north', 'health center north', 'centre de sante nord'],
	'PHC-S': ['health centre south', 'health center south', 'centre de sante sud']
};

const SPECIMEN_ALIASES: Record<Specimen, string[]> = {
	urine: ['urin', 'uti$', 'ivu$', 'virtsa', 'cystit', 'pyelo', 'kystiitt'],
	blood: ['blood', 'bacteraemi', 'bacteremi', 'bacteriemi', 'sepsis', 'septic', 'sang', 'veri'],
	wound: ['wound', 'plaie', 'haava', 'skin', 'cutane', 'iho']
};

const ORGANISM_ALIASES: Record<string, string[]> = {
	'Escherichia coli': ['e. coli', 'e.coli', 'coli'],
	'Staphylococcus aureus': ['mrsa', 's. aureus', 'staph', 'stafylokok'],
	'Enterococcus faecalis': ['vre', 'enterocoq', 'enterokok'],
	'Pseudomonas aeruginosa': ['pyocyan']
};

/** Drug classes that point at one representative agent. */
const CLASS_ALIASES: Record<string, string[]> = {
	CRO: ['3rd generation cephalosporin', 'third-generation cephalosporin', 'c3g', 'kefalosporiini'],
	MEM: ['carbapenem', 'karbapeneem'],
	CIP: ['quinolon', 'kinolon']
};

function organismAliases(organism: string): string[] {
	const [genus, species] = organism.split(' ');
	return [
		organism,
		species,
		`${genus[0]}. ${species}`,
		genus,
		...(ORGANISM_ALIASES[organism] ?? [])
	];
}

/** Word stems that survive French and Finnish spellings (ceftriaxone, keftriaksoni…). */
function antibioticAliases(ab: AntibioticInfo): string[] {
	const stem = (name: string) =>
		normalize(name)
			.replace(/ \(.*\)/, '')
			.slice(0, 7);
	return [ab.name, stem(ab.name), stem(ab.nameFi), ...(CLASS_ALIASES[ab.code] ?? [])];
}

function matchWard(value: string, catalog: Catalog): string | undefined {
	const v = normalize(value).trim();
	const byCode = catalog.wards.find((w) => normalize(w.code) === v);
	if (byCode) return byCode.code;
	return catalog.wards.find((w) =>
		[w.nameEn, w.nameFi, ...(WARD_ALIASES[w.code] ?? [])].some((a) => mentions(v, a))
	)?.code;
}

function matchOrganism(value: string, catalog: Catalog): string | undefined {
	const v = normalize(value).trim();
	const exact = catalog.organisms.find((o) => normalize(o) === v);
	if (exact) return exact;
	// Full names and species first, then genus (most frequent species wins).
	for (const pass of [0, 1]) {
		const hit = catalog.organisms.find((o) =>
			organismAliases(o)
				.filter((_, i) => (pass === 0 ? i !== 3 : i === 3))
				.some((a) => mentions(v, a))
		);
		if (hit) return hit;
	}
	return undefined;
}

function matchAntibiotic(value: string, catalog: Catalog): string | undefined {
	const code = catalog.antibiotics.find((a) => a.code === value.trim().toUpperCase());
	if (code) return code.code;
	const v = normalize(value);
	return catalog.antibiotics.find((a) => antibioticAliases(a).some((alias) => mentions(v, alias)))
		?.code;
}

function matchSpecimen(value: string): Specimen | undefined {
	const v = normalize(value);
	return SPECIMENS.find((s) => s === v.trim() || SPECIMEN_ALIASES[s].some((a) => mentions(v, a)));
}

function ageGroup(value: unknown): AgeGroup | undefined {
	if (typeof value === 'string' && value in AGE_GROUPS) return value as AgeGroup;
	const years = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(years) || years < 0 || years > 120) return undefined;
	return (Object.keys(AGE_GROUPS) as AgeGroup[]).find(
		(g) => years >= AGE_GROUPS[g].min && years <= AGE_GROUPS[g].max
	);
}

function matchSex(value: string): Sex | undefined {
	const v = normalize(value).trim();
	if (['f', 'female', 'woman', 'women', 'femme', 'nainen'].includes(v)) return 'F';
	if (['m', 'male', 'man', 'men', 'homme', 'mies'].includes(v)) return 'M';
	return undefined;
}

const str = (value: unknown) =>
	typeof value === 'string' && value.trim() && !/^(null|none|any|unknown|all)$/i.test(value.trim())
		? value
		: undefined;

/**
 * Checks a model-proposed intent field by field: unknown codes are dropped (and reported),
 * never passed on. Accepts codes, names, synonyms and ages in years.
 */
export function validateIntent(
	raw: unknown,
	catalog: Catalog
): { intent: Intent; dropped: string[] } {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const dropped: string[] = [];
	const check = <T>(key: string, value: unknown, match: (v: string) => T | undefined) => {
		const s = typeof value === 'number' ? String(value) : str(value);
		if (s === undefined) return undefined;
		const result = match(s);
		if (result === undefined) dropped.push(`${key}: ${s}`);
		return result;
	};

	const intent: Intent = {
		type: QUESTION_TYPES.includes(input.type as QuestionType)
			? (input.type as QuestionType)
			: 'resistance',
		ward: check('ward', input.ward, (v) => matchWard(v, catalog)),
		specimen: check('specimen', input.specimen, matchSpecimen),
		organism: check('organism', input.organism, (v) => matchOrganism(v, catalog)),
		antibiotic: check('antibiotic', input.antibiotic, (v) => matchAntibiotic(v, catalog)),
		site: check('site', input.site, (v) =>
			SITE_KEYS.includes(v as Site) ? (v as Site) : undefined
		),
		sex: check('sex', input.sex, matchSex),
		age: check('age', input.age, ageGroup),
		asOf: check('date', input.date ?? input.asOf, (v) =>
			/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= catalog.firstDate && v <= catalog.lastDate
				? v
				: undefined
		)
	};
	if (!QUESTION_TYPES.includes(input.type as QuestionType) && input.type !== undefined)
		dropped.push(`type: ${String(input.type)}`);
	return { intent: compact(intent), dropped };
}

function compact(intent: Intent): Intent {
	return Object.fromEntries(Object.entries(intent).filter(([, v]) => v !== undefined)) as Intent;
}

const THERAPY_WORDS = [
	'give',
	'prescri',
	'treat',
	'therapy',
	'empiric',
	'which antibiotic',
	'what antibiotic',
	'donner',
	'traitement',
	'traiter',
	'antibiotherapie',
	'hoito',
	'hoida',
	'anna',
	'antaa',
	'laake'
];
const ALERT_WORDS = [
	'alert',
	'outbreak',
	'cluster',
	'anomal',
	'epidemi',
	'unusual',
	'alerte',
	'foyer',
	'halytys',
	'rypa',
	'poikkea'
];
const FEVER_WORDS = ['febrile', 'fever', 'fievre', 'kuume', 'pyelo'];
const CYSTITIS_WORDS = ['cystit', 'lower uti', 'kystiitt', 'virtsarakko'];

/**
 * Keyword reading of the question in English, French or Finnish. It runs without any model, so
 * the assistant still answers when the LLM is down, and fills fields a small model missed.
 */
export function keywordIntent(question: string, catalog: Catalog): Intent {
	const q = normalize(question);
	const has = (words: string[]) => words.some((w) => mentions(q, w));
	const type: QuestionType = has(THERAPY_WORDS)
		? 'therapy'
		: has(ALERT_WORDS)
			? 'alerts'
			: 'resistance';

	const raw: Record<string, unknown> = { type };
	raw.ward = catalog.wards.find(
		(w) =>
			new RegExp(`\\b${w.code.toLowerCase()}\\b`).test(q) ||
			[w.nameEn, w.nameFi, ...(WARD_ALIASES[w.code] ?? [])].some((a) => mentions(q, a))
	)?.code;
	raw.organism = matchOrganism(q, catalog);
	raw.antibiotic = catalog.antibiotics.find(
		(a) =>
			new RegExp(`\\b${a.code}\\b`).test(question) ||
			antibioticAliases(a).some((alias) => mentions(q, alias))
	)?.code;
	raw.specimen = matchSpecimen(q);

	if (type === 'therapy') {
		raw.site =
			raw.specimen === 'urine'
				? has(CYSTITIS_WORDS) && !has(FEVER_WORDS)
					? 'cystitis'
					: 'febrile-uti'
				: raw.specimen;
		const years = q.match(/(\d{1,3})\s*(-?\s*(year|yr|y\.?o|ans?\b|an\b|vuot|v\b))/);
		if (years) raw.age = Number(years[1]);
		if (/\b(woman|women|female|femme|nainen|nais)/.test(q)) raw.sex = 'F';
		else if (/\b(man|men|male|hommes?)\b|\b(mies|miehe)/.test(q)) raw.sex = 'M';
	}
	raw.date = question.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
	return validateIntent(raw, catalog).intent;
}

const FINNISH_WORDS = /\b(onko|mita|miten|kuinka|mika|ja|on|osasto\w*|vuotia\w*|resistenssi\w*)\b/;
const FRENCH_WORDS =
	/\b(le|la|les|des|du|est|comment|quel\w*|pour|dans|une|aux|y a-t-il|evolue|faut-il)\b/;

/** Language of the question, so the model can be told explicitly (small models drift to English). */
export function questionLanguage(question: string): 'English' | 'French' | 'Finnish' {
	const q = normalize(question);
	if (/[äö]/i.test(question) || FINNISH_WORDS.test(q)) return 'Finnish';
	if (/[éèêàçùœ]/i.test(question) || FRENCH_WORDS.test(q)) return 'French';
	return 'English';
}

/** Model fields win; keyword fields fill the gaps a small model leaves. */
export function mergeIntents(
	model: Intent,
	keywords: Intent
): { intent: Intent; ungrounded: string[] } {
	// Small models like to fill every parameter ("antibiotic: ampicillin", "date: YYYY-MM-DD").
	// These filters narrow the answer, so they are kept only if the question itself names one.
	const ungrounded: string[] = [];
	const grounded = { ...model };
	for (const field of GROUNDED_FIELDS) {
		if (grounded[field] !== undefined && keywords[field] === undefined) {
			ungrounded.push(`${field}: ${grounded[field]}`);
			delete grounded[field];
		}
	}
	return { intent: { ...keywords, ...grounded }, ungrounded };
}

const GROUNDED_FIELDS = ['antibiotic', 'specimen', 'sex', 'age', 'asOf'] as const;

/** The deterministic functions exposed to tool-calling models, one per question type. */
export function intentTools(catalog: Catalog): ToolSpec[] {
	const common = {
		ward: {
			type: 'string',
			enum: catalog.wards.map((w) => w.code),
			description: catalog.wards.map((w) => `${w.code} = ${w.nameEn}`).join(', ')
		},
		specimen: { type: 'string', enum: SPECIMENS },
		organism: { type: 'string', enum: catalog.organisms },
		date: { type: 'string', description: 'Reference date YYYY-MM-DD, only if the user gives one' }
	};
	return [
		{
			name: 'resistance',
			description:
				'Susceptibility / resistance levels and their evolution for an organism in a ward and specimen.',
			parameters: {
				type: 'object',
				properties: {
					...common,
					antibiotic: { type: 'string', enum: catalog.antibiotics.map((a) => a.name) }
				}
			}
		},
		{
			name: 'therapy',
			description:
				'Empirical antibiotic choice for a patient before culture results (which drug to give).',
			parameters: {
				type: 'object',
				properties: {
					ward: common.ward,
					site: {
						type: 'string',
						enum: SITE_KEYS,
						description: SITE_KEYS.map((s) => `${s} = ${SITES[s].label}`).join(', ')
					},
					sex: { type: 'string', enum: ['F', 'M'] },
					age: { type: 'integer', description: 'Age in years' },
					date: common.date
				}
			}
		},
		{
			name: 'alerts',
			description: 'Active outbreaks, clusters and unusual resistance signals.',
			parameters: { type: 'object', properties: { ward: common.ward, date: common.date } }
		}
	];
}

/** Prompt for models without tool calling: same fields, as one JSON object. */
export function intentPrompt(catalog: Catalog): string {
	return [
		'Extract the intent of a clinical microbiology question as one JSON object with keys:',
		'type: "resistance" (susceptibility levels or trends), "therapy" (which antibiotic to give) or "alerts" (outbreaks, clusters);',
		`ward: one of ${catalog.wards.map((w) => `${w.code} (${w.nameEn})`).join(', ')};`,
		`specimen: urine, blood or wound; organism: one of ${catalog.organisms.join(', ')};`,
		`antibiotic: one of ${catalog.antibiotics.map((a) => a.name).join(', ')};`,
		`site (therapy only): ${SITE_KEYS.join(', ')}; sex: F or M; age: years; date: YYYY-MM-DD.`,
		'Use null for anything the question does not mention. The question may be in English, French or Finnish. Reply with JSON only.'
	].join('\n');
}
