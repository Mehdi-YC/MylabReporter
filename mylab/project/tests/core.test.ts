import { describe, expect, test } from 'bun:test';
import { firstIsolates } from '../src/lib/amr/firstIsolate';
import { MIN_ISOLATES, poissonUpperTail, proportion } from '../src/lib/amr/stats';
import { addDays, dayNumber, surveillanceWindows, weekStart } from '../src/lib/amr/dates';
import { makeIsolate } from './helpers';

describe('firstIsolates', () => {
	test('keeps the earliest isolate per patient, organism and specimen', () => {
		const late = makeIsolate({ patientId: 'P1', date: '2026-02-10', results: { CIP: 'R' } });
		const early = makeIsolate({ patientId: 'P1', date: '2026-02-01', results: { CIP: 'S' } });
		const kept = firstIsolates([late, early]);
		expect(kept).toEqual([early]);
	});

	test('counts different organisms, specimens and patients separately', () => {
		const records = [
			makeIsolate({ patientId: 'P1' }),
			makeIsolate({ patientId: 'P1', organism: 'Klebsiella pneumoniae' }),
			makeIsolate({ patientId: 'P1', specimen: 'blood' }),
			makeIsolate({ patientId: 'P2' })
		];
		expect(firstIsolates(records)).toHaveLength(4);
	});

	test('does not mutate its input', () => {
		const records = [makeIsolate({ date: '2026-03-01' }), makeIsolate({ date: '2026-01-01' })];
		const copy = [...records];
		firstIsolates(records);
		expect(records).toEqual(copy);
	});
});

describe('proportion', () => {
	test('returns nulls for an empty denominator', () => {
		expect(proportion(0, 0)).toMatchObject({ p: null, low: null, high: null, reliable: false });
	});

	test('computes a Wilson interval that contains the estimate', () => {
		const r = proportion(10, 100);
		expect(r.p).toBeCloseTo(0.1);
		expect(r.low!).toBeCloseTo(0.0552, 3);
		expect(r.high!).toBeCloseTo(0.1744, 3);
	});

	test('stays inside [0, 1] at the edges', () => {
		expect(proportion(0, 5).low).toBe(0);
		expect(proportion(5, 5).high).toBe(1);
	});

	test(`flags fewer than ${MIN_ISOLATES} isolates as unreliable`, () => {
		expect(proportion(3, MIN_ISOLATES - 1).reliable).toBe(false);
		expect(proportion(3, MIN_ISOLATES).reliable).toBe(true);
	});
});

describe('poissonUpperTail', () => {
	test('matches known values', () => {
		expect(poissonUpperTail(0, 2)).toBe(1);
		expect(poissonUpperTail(1, 2)).toBeCloseTo(1 - Math.exp(-2));
		// P(X ≥ 5 | λ = 1) ≈ 0.00366
		expect(poissonUpperTail(5, 1)).toBeCloseTo(0.00366, 4);
	});
});

describe('dates', () => {
	test('adds days across month and year boundaries', () => {
		expect(addDays('2025-12-30', 3)).toBe('2026-01-02');
		expect(dayNumber('2024-03-01') - dayNumber('2024-02-28')).toBe(2); // leap year
	});

	test('builds a 28-day and a 365-day window ending on the reference date', () => {
		const { recent, annual } = surveillanceWindows('2026-09-27');
		expect(recent).toEqual({ from: '2026-08-31', to: '2026-09-27' });
		expect(dayNumber(annual.to) - dayNumber(annual.from)).toBe(364);
	});

	test('finds the Monday of the ISO week', () => {
		expect(weekStart('2026-09-27')).toBe('2026-09-21'); // Sunday
		expect(weekStart('2026-09-21')).toBe('2026-09-21'); // Monday
	});
});
