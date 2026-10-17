import type { Alert } from './anomalies';
import { proportion, type Proportion } from './stats';
import type { AntibioticInfo, IsolateRecord, Specimen } from './types';

/** Clinical syndrome → culture specimen used as evidence. */
export const SITES = {
	cystitis: { label: 'Cystitis (lower UTI)', specimen: 'urine' },
	'febrile-uti': { label: 'Febrile UTI / pyelonephritis', specimen: 'urine' },
	blood: { label: 'Bloodstream infection', specimen: 'blood' },
	wound: { label: 'Skin / wound infection', specimen: 'wound' }
} as const satisfies Record<string, { label: string; specimen: Specimen }>;
export type Site = keyof typeof SITES;

export const AGE_GROUPS = {
	child: { label: '< 18', min: 0, max: 17 },
	adult: { label: '18–64', min: 18, max: 64 },
	elderly: { label: '≥ 65', min: 65, max: 200 }
} as const;
export type AgeGroup = keyof typeof AGE_GROUPS;

/**
 * Narrow → broad, used to point at the narrowest drug that reaches the coverage target
 * (antimicrobial stewardship). Screening agents are not treatment options.
 */
export const SPECTRUM_ORDER = [
	'NIT',
	'MEC',
	'TMP',
	'AMP',
	'CLI',
	'CXM',
	'CIP',
	'CRO',
	'CAZ',
	'VAN',
	'TZP',
	'MEM'
];

export const DRUG_NOTES: Record<string, { tag?: string; note: string }> = {
	NIT: { tag: 'lower UTI only', note: 'No tissue or blood levels: cystitis only.' },
	MEC: { tag: 'lower UTI only', note: 'Oral pivmecillinam for cystitis.' },
	TMP: { tag: 'lower UTI only', note: 'Cystitis; check local resistance.' },
	VAN: { tag: 'Gram-positive only', note: 'No activity against Gram-negative bacteria.' },
	CLI: { tag: 'Gram-positive only', note: 'Staphylococci and streptococci.' },
	TZP: { tag: 'broad spectrum', note: 'Keep for severe or hospital-onset infections.' },
	MEM: { tag: 'reserve', note: 'Carbapenem: reserve for ESBL / critically ill patients.' }
};

export interface CoverageOption {
	code: string;
	/** Share of first isolates in the context susceptible to this drug (untested = not covered). */
	coverage: Proportion;
	/** Same over the last 4 weeks, when available. */
	recent: Proportion | null;
	/** Active alerts in the ward that make this drug less reliable right now. */
	warnings: string[];
}

export interface OrganismShare {
	organism: string;
	share: number;
	count: number;
}

/**
 * Probability that one antibiotic covers the pathogen of the next patient in this context:
 * the share of first isolates that are susceptible, all organisms pooled (a syndromic,
 * weighted-incidence antibiogram). An organism not tested for a drug counts as not covered,
 * since intrinsically resistant pairs are not reported in the extract.
 */
export function coverage(isolates: IsolateRecord[], code: string): Proportion {
	return proportion(isolates.filter((i) => i.results[code] === 'S').length, isolates.length);
}

export function organismMix(isolates: IsolateRecord[]): OrganismShare[] {
	const counts: Record<string, number> = {};
	for (const i of isolates) counts[i.organism] = (counts[i.organism] ?? 0) + 1;
	return Object.entries(counts)
		.map(([organism, count]) => ({ organism, count, share: count / isolates.length }))
		.sort((a, b) => b.count - a.count);
}

const BETA_LACTAMS = ['AMP', 'MEC', 'TZP', 'CXM', 'CRO', 'CAZ', 'MEM'];
const ESBL_AFFECTED = ['AMP', 'CXM', 'CRO', 'CAZ'];

/** Why an active alert weakens a drug, as data the pages can word in Finnish or English. */
export type WarningItem =
	| { kind: 'rise'; organism: string; observed: number; expected: number }
	| { kind: 'esbl' | 'mrsa'; cases: number }
	| { kind: 'cpe' | 'vre' };

/** Turns the active alerts of a ward into per-drug warning items. */
export function alertWarningItems(alerts: Alert[]): Record<string, WarningItem[]> {
	const out: Record<string, WarningItem[]> = {};
	const add = (code: string, item: WarningItem) => {
		const list = (out[code] ??= []);
		if (!list.some((x) => JSON.stringify(x) === JSON.stringify(item))) list.push(item);
	};
	for (const a of alerts) {
		if (a.kind === 'resistance-rise' && a.antibiotic && a.organism) {
			add(a.antibiotic, {
				kind: 'rise',
				organism: a.organism,
				observed: Math.round(a.observed * 100),
				expected: Math.round(a.expected * 100)
			});
		}
		if (a.phenotype === 'esbl')
			for (const code of ESBL_AFFECTED) add(code, { kind: 'esbl', cases: a.observed });
		if (a.phenotype === 'mrsa')
			for (const code of BETA_LACTAMS) add(code, { kind: 'mrsa', cases: a.observed });
		if (a.phenotype === 'cpe') add('MEM', { kind: 'cpe' });
		if (a.phenotype === 'vre') add('VAN', { kind: 'vre' });
	}
	return out;
}

/** English wording of a warning (assistant facts and logs). */
export function warningText(w: WarningItem): string {
	switch (w.kind) {
		case 'rise':
			return `${w.organism}: ${w.observed} % resistant in the last 4 weeks (baseline ${w.expected} %)`;
		case 'esbl':
			return `Active ESBL cluster (${w.cases} cases)`;
		case 'mrsa':
			return `Active MRSA cluster (${w.cases} cases): β-lactams do not cover MRSA`;
		case 'cpe':
			return 'CPE case in the ward: carbapenem resistance possible';
		case 'vre':
			return 'VRE case in the ward';
	}
}

/** Turns the active alerts of a ward into per-drug warnings (English text). */
export function alertWarnings(alerts: Alert[]): Record<string, string[]> {
	return Object.fromEntries(
		Object.entries(alertWarningItems(alerts)).map(([code, items]) => [code, items.map(warningText)])
	);
}

export function rankOptions(
	annual: IsolateRecord[],
	recent: IsolateRecord[],
	antibiotics: AntibioticInfo[],
	warnings: Record<string, string[]>
): CoverageOption[] {
	return antibiotics
		.filter((a) => SPECTRUM_ORDER.includes(a.code))
		.map((a) => ({
			code: a.code,
			coverage: coverage(annual, a.code),
			recent: recent.length ? coverage(recent, a.code) : null,
			warnings: warnings[a.code] ?? []
		}))
		.sort((a, b) => (b.coverage.p ?? 0) - (a.coverage.p ?? 0));
}

/**
 * Narrowest drug with at least `target` coverage (on ≥ 30 isolates) and no active warning.
 * `allowed` restricts the choice (e.g. no "lower UTI only" drugs for a febrile UTI).
 */
export function narrowestAdequate(
	options: CoverageOption[],
	target: number,
	allowed: (code: string) => boolean = () => true
): CoverageOption | null {
	const byCode = new Map(options.map((o) => [o.code, o]));
	for (const code of SPECTRUM_ORDER) {
		const option = byCode.get(code);
		if (!option || !allowed(code) || option.warnings.length) continue;
		if (option.coverage.reliable && option.coverage.p !== null && option.coverage.p >= target)
			return option;
	}
	return null;
}

/** Highest-coverage allowed drug without warnings, when nothing reaches the target. */
export function bestAvailable(
	options: CoverageOption[],
	allowed: (code: string) => boolean = () => true
): CoverageOption | null {
	return (
		options.find((o) => allowed(o.code) && !o.warnings.length && o.coverage.p !== null) ?? null
	);
}

/** Last-resort agents (carbapenems): never the first suggestion when a first-line drug works. */
export const RESERVE = Object.keys(DRUG_NOTES).filter((code) => DRUG_NOTES[code].tag === 'reserve');

export interface EmpiricChoice {
	/** Narrowest first-line drug reaching the target, else the best first-line drug. */
	pick: CoverageOption | null;
	adequate: boolean;
	/** When no first-line drug is adequate: the reserve drug that is, for severe cases. */
	reserve: CoverageOption | null;
}

/**
 * Stewardship rule shared by every screen: reserve drugs are offered only as a fallback, after
 * the first-line drugs, never as the first suggestion.
 */
export function empiricChoice(
	options: CoverageOption[],
	target: number,
	allowed: (code: string) => boolean = () => true
): EmpiricChoice {
	const firstLine = (code: string) => allowed(code) && !RESERVE.includes(code);
	const best = narrowestAdequate(options, target, firstLine);
	if (best) return { pick: best, adequate: true, reserve: null };
	return {
		pick: bestAvailable(options, firstLine),
		adequate: false,
		reserve: narrowestAdequate(options, target, (code) => allowed(code) && RESERVE.includes(code))
	};
}

/** Organisms most often left uncovered by a drug, as a share of all isolates in the context. */
export function coverageGaps(isolates: IsolateRecord[], code: string, limit = 3): OrganismShare[] {
	const missed = isolates.filter((i) => i.results[code] !== 'S');
	return organismMix(missed)
		.slice(0, limit)
		.map((g) => ({ ...g, share: g.count / isolates.length }));
}

export interface Combination {
	codes: [string, string];
	/** Share of isolates susceptible to at least one of the two drugs. */
	coverage: Proportion;
}

/**
 * Best two-drug regimen by pooled coverage (isolate covered if susceptible to either drug),
 * among allowed drugs without active warnings. Ties go to the narrower pair.
 */
export function bestCombination(
	isolates: IsolateRecord[],
	options: CoverageOption[],
	allowed: (code: string) => boolean = () => true
): Combination | null {
	const codes = options
		.filter((o) => allowed(o.code) && !o.warnings.length)
		.map((o) => o.code)
		.sort((a, b) => SPECTRUM_ORDER.indexOf(a) - SPECTRUM_ORDER.indexOf(b));
	let best: Combination | null = null;
	for (let i = 0; i < codes.length; i++) {
		for (let j = i + 1; j < codes.length; j++) {
			const [a, b] = [codes[i], codes[j]];
			const k = isolates.filter((x) => x.results[a] === 'S' || x.results[b] === 'S').length;
			const share = proportion(k, isolates.length);
			if (!best || (share.p ?? 0) > (best.coverage.p ?? 0))
				best = { codes: [a, b], coverage: share };
		}
	}
	return best;
}
