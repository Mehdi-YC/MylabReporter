import { describe, expect, test } from 'bun:test';
import {
	alertWarnings,
	bestCombination,
	coverage,
	coverageGaps,
	empiricChoice,
	narrowestAdequate,
	organismMix,
	rankOptions
} from '../src/lib/amr/advisor';
import type { Alert } from '../src/lib/amr/anomalies';
import type { AntibioticInfo, IsolateRecord } from '../src/lib/amr/types';
import { makeIsolate } from './helpers';

const ab = (code: string): AntibioticInfo => ({
	code,
	name: code.toLowerCase(),
	nameFi: code,
	class: 'x',
	reportedFor: 'all'
});
const ANTIBIOTICS = ['NIT', 'MEC', 'CRO', 'MEM', 'FOX'].map(ab);

function cohort(n: number, results: IsolateRecord['results'], organism = 'Escherichia coli') {
	return Array.from({ length: n }, (_, i) =>
		makeIsolate({ patientId: `${organism}-${i}-${Math.random()}`, organism, results })
	);
}

describe('coverage', () => {
	test('counts untested organisms as not covered', () => {
		const isolates = [
			...cohort(8, { NIT: 'S' }),
			...cohort(2, {}, 'Pseudomonas aeruginosa') // NIT not reported: intrinsically resistant
		];
		expect(coverage(isolates, 'NIT')).toMatchObject({ k: 8, n: 10 });
	});
});

describe('organismMix', () => {
	test('returns shares, most common first', () => {
		const mix = organismMix([...cohort(3, {}), ...cohort(1, {}, 'Proteus mirabilis')]);
		expect(mix[0]).toMatchObject({ organism: 'Escherichia coli', count: 3, share: 0.75 });
	});
});

describe('rankOptions and narrowestAdequate', () => {
	// 200 isolates: NIT 99 %, MEC 85 %, CRO 97 %, MEM 100 %.
	const isolates = [
		...cohort(170, { NIT: 'S', MEC: 'S', CRO: 'S', MEM: 'S' }),
		...cohort(24, { NIT: 'S', MEC: 'R', CRO: 'S', MEM: 'S' }),
		...cohort(4, { NIT: 'S', MEC: 'R', CRO: 'R', MEM: 'S' }),
		...cohort(2, { NIT: 'R', MEC: 'R', CRO: 'R', MEM: 'S' })
	];

	test('ranks by coverage and drops screening agents', () => {
		const options = rankOptions(isolates, [], ANTIBIOTICS, {});
		expect(options.map((o) => o.code)).toEqual(['MEM', 'NIT', 'CRO', 'MEC']);
		expect(options.find((o) => o.code === 'FOX')).toBeUndefined();
	});

	test('picks the narrowest drug reaching the target on at least 30 isolates', () => {
		const options = rankOptions(isolates, [], ANTIBIOTICS, {});
		expect(narrowestAdequate(options, 0.9)?.code).toBe('NIT');
		// Outside the urinary tract nitrofurantoin is not an option → next narrowest adequate drug.
		expect(narrowestAdequate(options, 0.9, (c) => c !== 'NIT')?.code).toBe('CRO');
		expect(narrowestAdequate(options, 0.995)?.code).toBe('MEM');
		// Too few isolates: no recommendation, however good the percentage looks.
		const small = rankOptions(isolates.slice(0, 20), [], ANTIBIOTICS, {});
		expect(narrowestAdequate(small, 0.9)).toBeNull();
	});

	test('skips drugs with an active warning', () => {
		const options = rankOptions(isolates, [], ANTIBIOTICS, { NIT: ['cluster'] });
		expect(narrowestAdequate(options, 0.9)?.code).toBe('CRO');
	});
});

describe('empiricChoice (stewardship)', () => {
	test('a first-line drug that reaches the target wins over the reserve', () => {
		const iso = [...cohort(36, { CRO: 'S', MEM: 'S' }), ...cohort(4, { CRO: 'R', MEM: 'S' })];
		const choice = empiricChoice(rankOptions(iso, [], ANTIBIOTICS, {}), 0.8);
		expect(choice).toMatchObject({ adequate: true, reserve: null });
		expect(choice.pick?.code).toBe('CRO');
	});

	test('when only the reserve reaches the target, it is the fallback, not the pick', () => {
		const iso = [...cohort(25, { CRO: 'S', MEM: 'S' }), ...cohort(15, { CRO: 'R', MEM: 'S' })];
		const choice = empiricChoice(rankOptions(iso, [], ANTIBIOTICS, {}), 0.8);
		expect(choice.adequate).toBe(false);
		expect(choice.pick?.code).toBe('CRO');
		expect(choice.reserve?.code).toBe('MEM');
	});
});

describe('alertWarnings', () => {
	const base = {
		severity: 'critical',
		ward: 'URO',
		expected: 1,
		pValue: 0,
		window: { from: '2025-06-01', to: '2025-06-28' },
		cases: [],
		investigation: { hospitalOnset: 0, sameProfile: 0, firstSeen: '', lastSeen: '' }
	} as const;

	test('maps an ESBL cluster to the cephalosporins and a resistance rise to its drug', () => {
		const alerts: Alert[] = [
			{ ...base, id: 'a', kind: 'phenotype-cluster', phenotype: 'esbl', observed: 12 },
			{
				...base,
				id: 'b',
				kind: 'resistance-rise',
				severity: 'warning',
				organism: 'Escherichia coli',
				antibiotic: 'CIP',
				observed: 0.46,
				expected: 0.12
			}
		];
		const warnings = alertWarnings(alerts);
		expect(warnings.CRO).toEqual(['Active ESBL cluster (12 cases)']);
		expect(warnings.CIP[0]).toContain('46 % resistant');
		expect(warnings.MEM).toBeUndefined();
	});
});

describe('bestCombination and coverageGaps', () => {
	const isolates = [
		...cohort(60, { CRO: 'S', VAN: 'R' }, 'Escherichia coli'),
		...cohort(40, { VAN: 'S' }, 'Staphylococcus aureus')
	];
	const options = rankOptions(isolates, [], ['CRO', 'VAN', 'MEM'].map(ab), {});

	test('pools coverage of two complementary drugs', () => {
		const combo = bestCombination(isolates, options);
		expect(combo?.codes).toEqual(['CRO', 'VAN']);
		expect(combo?.coverage).toMatchObject({ k: 100, n: 100 });
	});

	test('lists the organisms a drug leaves uncovered', () => {
		expect(coverageGaps(isolates, 'CRO')).toEqual([
			{ organism: 'Staphylococcus aureus', count: 40, share: 0.4 }
		]);
	});
});
