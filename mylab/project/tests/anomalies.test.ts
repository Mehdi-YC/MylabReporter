import { describe, expect, test } from 'bun:test';
import { alertTimeline, detectAnomalies, wardLevels } from '../src/lib/amr/anomalies';
import { addDays } from '../src/lib/amr/dates';
import { binomialUpperTail } from '../src/lib/amr/stats';
import type { IsolateRecord } from '../src/lib/amr/types';
import { makeIsolate } from './helpers';

const AS_OF = '2026-06-30';

/** A quiet year: one E. coli per patient every 3 days, all susceptible, in MED-A. */
function background(days = 392, ward = 'MED-A'): IsolateRecord[] {
	const records: IsolateRecord[] = [];
	for (let d = 0; d < days; d += 3) {
		records.push(
			makeIsolate({
				patientId: `${ward}-bg-${d}`,
				ward,
				date: addDays(AS_OF, -d),
				results: { CIP: 'S', CRO: 'S' }
			})
		);
	}
	return records;
}

describe('binomialUpperTail', () => {
	test('matches known values', () => {
		expect(binomialUpperTail(0, 10, 0.3)).toBe(1);
		expect(binomialUpperTail(10, 10, 0.5)).toBeCloseTo(1 / 1024, 6);
		// P(X ≥ 3 | n = 10, p = 0.1) ≈ 0.0702
		expect(binomialUpperTail(3, 10, 0.1)).toBeCloseTo(0.0702, 3);
	});

	test('handles large n without underflow', () => {
		const p = binomialUpperTail(60, 300, 0.1);
		expect(p).toBeGreaterThan(0);
		expect(p).toBeLessThan(1e-4);
	});
});

describe('detectAnomalies', () => {
	test('stays silent on stable data', () => {
		expect(detectAnomalies(background(), AS_OF)).toEqual([]);
	});

	test('raises a critical sentinel alert for a single CPE', () => {
		const records = [
			...background(),
			makeIsolate({
				patientId: 'cpe',
				ward: 'MED-A',
				date: addDays(AS_OF, -2),
				organism: 'Klebsiella pneumoniae',
				cpe: true
			})
		];
		const alerts = detectAnomalies(records, AS_OF);
		expect(alerts).toHaveLength(1);
		expect(alerts[0]).toMatchObject({ kind: 'sentinel', severity: 'critical', phenotype: 'cpe' });
	});

	test('a cluster outranks a sentinel case in the ward level', () => {
		const records = [
			...background(),
			makeIsolate({ patientId: 'v', date: addDays(AS_OF, -1), vre: true }),
			...Array.from({ length: 8 }, (_, i) =>
				makeIsolate({ patientId: `e${i}`, date: addDays(AS_OF, -i), esbl: true })
			)
		];
		expect(wardLevels(detectAnomalies(records, AS_OF))).toEqual({ 'MED-A': 'critical' });
	});

	test('detects an ESBL cluster with its investigation', () => {
		const cluster = Array.from({ length: 8 }, (_, i) =>
			makeIsolate({
				patientId: `esbl-${i}`,
				ward: 'MED-A',
				date: addDays(AS_OF, -i * 2),
				esbl: true,
				hospitalOnset: i < 6,
				results: { CIP: 'R', CRO: 'R' }
			})
		);
		const alerts = detectAnomalies([...background(), ...cluster], AS_OF);
		const esbl = alerts.find((a) => a.kind === 'phenotype-cluster');
		expect(esbl).toMatchObject({ ward: 'MED-A', phenotype: 'esbl', observed: 8 });
		expect(esbl!.investigation).toMatchObject({ hospitalOnset: 6, sameProfile: 8 });
		// The same isolates also push resistance well above the ward's baseline.
		expect(alerts.some((a) => a.kind === 'resistance-rise' && a.antibiotic === 'CRO')).toBe(true);
	});

	test('ignores cases outside the 4-week window and after the reference date', () => {
		const late = makeIsolate({ patientId: 'x', date: addDays(AS_OF, 1), cpe: true });
		const old = makeIsolate({ patientId: 'y', date: addDays(AS_OF, -40), cpe: true });
		expect(detectAnomalies([...background(), late, old], AS_OF)).toEqual([]);
	});

	test('does not alert on a handful of cases against a zero baseline', () => {
		const pair = [0, 1].map((i) =>
			makeIsolate({ patientId: `m${i}`, date: addDays(AS_OF, -i), mrsa: true })
		);
		expect(detectAnomalies([...background(), ...pair], AS_OF)).toEqual([]);
	});
});

describe('alertTimeline', () => {
	test('returns one entry per week, oldest first, with ward status', () => {
		const records = [
			...background(),
			makeIsolate({ patientId: 'v', date: addDays(AS_OF, -3), vre: true })
		];
		const weeks = alertTimeline(records, addDays(AS_OF, -21), AS_OF);
		expect(weeks.map((w) => w.asOf)).toEqual([
			addDays(AS_OF, -21),
			addDays(AS_OF, -14),
			addDays(AS_OF, -7),
			AS_OF
		]);
		// A lone VRE is critical but shown as a sentinel case, not as an outbreak.
		expect(weeks[3]).toMatchObject({ critical: 1, wards: { 'MED-A': 'sentinel' } });
		expect(weeks[0].critical).toBe(0);
	});
});
