import { describe, expect, test } from 'bun:test';
import {
	antibiogram,
	isSignificantDrop,
	matchesFilter,
	monthlyTrend,
	selectIsolates,
	susceptibleShare
} from '../src/lib/amr/antibiogram';
import { proportion } from '../src/lib/amr/stats';
import type { AntibioticInfo } from '../src/lib/amr/types';
import { makeIsolate } from './helpers';

const CIP: AntibioticInfo = {
	code: 'CIP',
	name: 'ciprofloxacin',
	nameFi: 'siprofloksasiini',
	class: 'fluoroquinolones',
	reportedFor: 'all'
};
const NIT: AntibioticInfo = { ...CIP, code: 'NIT', name: 'nitrofurantoin' };

describe('matchesFilter', () => {
	const record = makeIsolate({ ward: 'URO', sex: 'M', age: 70, hospitalOnset: true });

	test('an empty filter matches everything', () => {
		expect(matchesFilter(record, {})).toBe(true);
	});

	test('applies every criterion', () => {
		expect(matchesFilter(record, { ward: 'URO', sex: 'M', onset: 'hospital' })).toBe(true);
		expect(matchesFilter(record, { ward: 'ICU' })).toBe(false);
		expect(matchesFilter(record, { onset: 'community' })).toBe(false);
		expect(matchesFilter(record, { ageMin: 18, ageMax: 65 })).toBe(false);
	});
});

describe('selectIsolates', () => {
	test('restricts to the window before de-duplicating', () => {
		const window = { from: '2026-02-01', to: '2026-02-28' };
		const before = makeIsolate({ patientId: 'P9', date: '2026-01-15' });
		const inside = makeIsolate({ patientId: 'P9', date: '2026-02-10' });
		// The January isolate is outside the period, so February's counts as the first one.
		expect(selectIsolates([before, inside], {}, window)).toEqual([inside]);
	});
});

describe('susceptibleShare and antibiogram', () => {
	const records = [
		makeIsolate({ patientId: 'A', results: { CIP: 'S', NIT: 'S' } }),
		makeIsolate({ patientId: 'B', results: { CIP: 'R', NIT: 'S' } }),
		makeIsolate({ patientId: 'C', results: { CIP: 'S' } }),
		makeIsolate({ patientId: 'D', organism: 'Proteus mirabilis', results: { CIP: 'S' } })
	];

	test('ignores isolates that were not tested', () => {
		expect(susceptibleShare(records, 'NIT')).toMatchObject({ k: 2, n: 2 });
	});

	test('groups by organism, most frequent first, and omits untested drugs', () => {
		const rows = antibiogram(records, [CIP, NIT]);
		expect(rows.map((r) => r.organism)).toEqual(['Escherichia coli', 'Proteus mirabilis']);
		expect(rows[0].cells.CIP).toMatchObject({ k: 2, n: 3 });
		expect(rows[1].cells.NIT).toBeUndefined();
	});
});

describe('isSignificantDrop', () => {
	test('flags a clear fall against a solid baseline', () => {
		expect(isSignificantDrop(proportion(12, 20), proportion(180, 200))).toBe(true);
	});

	test('ignores noise and small samples', () => {
		expect(isSignificantDrop(proportion(17, 20), proportion(180, 200))).toBe(false);
		expect(isSignificantDrop(proportion(2, 5), proportion(180, 200))).toBe(false);
		expect(isSignificantDrop(proportion(5, 20), proportion(20, 25))).toBe(false);
	});
});

describe('monthlyTrend', () => {
	test('returns one point per calendar month ending with the reference month', () => {
		const records = [
			makeIsolate({ patientId: 'A', date: '2026-08-10', results: { CIP: 'R' } }),
			makeIsolate({ patientId: 'B', date: '2026-09-05', results: { CIP: 'S' } }),
			makeIsolate({ patientId: 'C', date: '2026-09-30', results: { CIP: 'R' } })
		];
		const trend = monthlyTrend(records, {}, 'CIP', '2026-09-20', 3);
		expect(trend.map((t) => t.month)).toEqual(['2026-07', '2026-08', '2026-09']);
		expect(trend[1].share).toMatchObject({ k: 0, n: 1 });
		// The 30 September sample is after the reference date and must be excluded.
		expect(trend[2].share).toMatchObject({ k: 1, n: 1 });
	});
});
