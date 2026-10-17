import { describe, expect, test } from 'bun:test';
import {
	monthlyResistance,
	monthWindows,
	normalUpperTail,
	resistanceOutlook,
	type MonthCount
} from '../src/lib/amr/forecast';
import { makeIsolate } from './helpers';

const series = (rates: number[], n = 40): MonthCount[] =>
	rates.map((r, i) => ({
		month: `2025-${String(i + 1).padStart(2, '0')}`,
		k: Math.round(r * n),
		n
	}));

describe('normal tail', () => {
	test('matches known values', () => {
		expect(normalUpperTail(0)).toBeCloseTo(0.5, 6);
		expect(normalUpperTail(1.96)).toBeCloseTo(0.025, 3);
		expect(normalUpperTail(-1.96)).toBeCloseTo(0.975, 3);
	});
});

describe('resistance outlook', () => {
	test('a steady climb is flagged with the time left before 20 %', () => {
		// 4 % → 15 % over 12 months, 80 isolates a month.
		const o = resistanceOutlook(
			series(
				Array.from({ length: 12 }, (_, i) => 0.04 + i * 0.01),
				80
			)
		)!;
		expect(o.trend).toBe('rising');
		expect(o.pValue).toBeLessThan(0.01);
		expect(o.slope).toBeCloseTo(1, 0);
		expect(o.current).toBeCloseTo(15, 0);
		expect(o.projected).toBeCloseTo(18, 0);
		expect(o.monthsToThreshold).toBeCloseTo(5, 0);
		expect(o.warning).toBe(true);
	});

	test('a flat series is stable and never warns', () => {
		const o = resistanceOutlook(series(Array(12).fill(0.1)))!;
		expect(o.trend).toBe('stable');
		expect(o.monthsToThreshold).toBeNull();
		expect(o.warning).toBe(false);
	});

	test('already above the threshold: rising but no countdown', () => {
		const o = resistanceOutlook(
			series(
				Array.from({ length: 12 }, (_, i) => 0.25 + i * 0.015),
				80
			)
		)!;
		expect(o.trend).toBe('rising');
		expect(o.monthsToThreshold).toBeNull();
		expect(o.warning).toBe(false);
	});

	test('a far-off crossing is reported but not a warning', () => {
		// +0.3 points a month from 5 %: about 3 years to 20 %.
		const o = resistanceOutlook(
			series(
				Array.from({ length: 24 }, (_, i) => 0.05 + i * 0.003),
				200
			)
		)!;
		expect(o.trend).toBe('rising');
		expect(o.monthsToThreshold).toBeGreaterThan(24);
		expect(o.warning).toBe(false);
	});

	test('too few isolates or months: no outlook', () => {
		expect(resistanceOutlook(series(Array(12).fill(0.1), 3))).toBeNull();
		expect(resistanceOutlook(series(Array(4).fill(0.1), 100))).toBeNull();
	});
});

describe('monthly counts', () => {
	test('calendar months end on the reference date', () => {
		const w = monthWindows('2025-06-30', 3);
		expect(w.map((m) => m.month)).toEqual(['2025-04', '2025-05', '2025-06']);
		expect(w[0]).toMatchObject({ from: '2025-04-01', to: '2025-04-30' });
	});

	test('counts first isolates, non-S as resistant, per drug', () => {
		const records = [
			makeIsolate({ patientId: 'A', date: '2025-05-03', results: { CRO: 'R', CIP: 'S' } }),
			makeIsolate({ patientId: 'A', date: '2025-05-20', results: { CRO: 'R' } }),
			makeIsolate({ patientId: 'B', date: '2025-05-10', results: { CRO: 'I' } }),
			makeIsolate({ patientId: 'C', date: '2025-06-02', results: { CRO: 'S' } }),
			makeIsolate({ patientId: 'D', date: '2025-06-02', ward: 'ICU', results: { CRO: 'R' } })
		];
		const out = monthlyResistance(records, { ward: 'MED-A' }, ['CRO', 'CIP'], '2025-06-30', 2);
		expect(out.CRO).toEqual([
			{ month: '2025-05', k: 2, n: 2 },
			{ month: '2025-06', k: 0, n: 1 }
		]);
		expect(out.CIP).toEqual([
			{ month: '2025-05', k: 0, n: 1 },
			{ month: '2025-06', k: 0, n: 0 }
		]);
	});
});
