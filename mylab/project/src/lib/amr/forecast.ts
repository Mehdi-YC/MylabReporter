import { matchesFilter, selectIsolates, type IsolateFilter } from './antibiogram';
import type { IsolateRecord } from './types';

/** Resistant (not S) and tested first isolates of one month. */
export interface MonthCount {
	month: string;
	k: number;
	n: number;
}

/**
 * Early warning for one organism × drug: is resistance drifting up month after month, and how
 * long until it reaches the level where the drug stops being a safe empirical choice?
 */
export interface Outlook {
	trend: 'rising' | 'falling' | 'stable';
	/** Two-sided p-value of the Cochran–Armitage test for trend. */
	pValue: number;
	/** Fitted change, in percentage points of resistance per month. */
	slope: number;
	/** Fitted resistance (%) in the last month. */
	current: number;
	/** Fitted resistance (%) `horizon` months ahead, kept within 0–100. */
	projected: number;
	horizon: number;
	/** Resistance (%) at which coverage falls below the 80 % empirical target. */
	threshold: number;
	/** Months until the fitted line reaches the threshold; null when not heading there. */
	monthsToThreshold: number | null;
	/** Rising, below the threshold today and expected to reach it within `warnWithin` months. */
	warning: boolean;
	/** Tested first isolates behind the estimate. */
	n: number;
}

export interface OutlookOptions {
	threshold?: number;
	horizon?: number;
	alpha?: number;
	minIsolates?: number;
	warnWithin?: number;
}

/** Standard normal upper tail, P(Z ≥ z) (Abramowitz & Stegun 7.1.26, error < 1.5e-7). */
export function normalUpperTail(z: number): number {
	const x = Math.abs(z) / Math.SQRT2;
	const t = 1 / (1 + 0.3275911 * x);
	const erf =
		1 -
		t *
			(0.254829592 +
				t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
			Math.exp(-x * x);
	const upper = (1 - erf) / 2;
	return z >= 0 ? upper : 1 - upper;
}

/**
 * Trend in monthly resistance: Cochran–Armitage test with month index as score, and the
 * n-weighted least-squares line through the monthly proportions (whose slope is T / Sxx).
 * Returns null when there are too few isolates to say anything.
 */
export function resistanceOutlook(
	months: MonthCount[],
	{
		threshold = 20,
		horizon = 3,
		alpha = 0.01,
		minIsolates = 60,
		warnWithin = 6
	}: OutlookOptions = {}
): Outlook | null {
	const used = months.map((m, x) => ({ ...m, x })).filter((m) => m.n > 0);
	const n = used.reduce((s, m) => s + m.n, 0);
	if (used.length < 6 || n < minIsolates) return null;
	const k = used.reduce((s, m) => s + m.k, 0);
	const pBar = k / n;
	const xBar = used.reduce((s, m) => s + m.n * m.x, 0) / n;
	const sxx = used.reduce((s, m) => s + m.n * (m.x - xBar) ** 2, 0);
	const t = used.reduce((s, m) => s + m.k * (m.x - xBar), 0);
	const variance = pBar * (1 - pBar) * sxx;
	const z = variance > 0 ? t / Math.sqrt(variance) : 0;
	const pValue = Math.min(1, 2 * normalUpperTail(Math.abs(z)));

	const slope = sxx > 0 ? (t / sxx) * 100 : 0;
	const last = months.length - 1;
	const fitted = (x: number) =>
		Math.min(100, Math.max(0, (pBar + (t / sxx || 0) * (x - xBar)) * 100));
	const current = fitted(last);
	const projected = fitted(last + horizon);
	const trend = pValue < alpha ? (slope > 0 ? 'rising' : 'falling') : 'stable';
	const monthsToThreshold =
		trend === 'rising' && current < threshold ? (threshold - current) / slope : null;
	const round = (v: number) => Math.round(v * 10) / 10;
	return {
		trend,
		pValue,
		slope: round(slope),
		current: round(current),
		projected: round(projected),
		horizon,
		threshold,
		monthsToThreshold: monthsToThreshold === null ? null : round(monthsToThreshold),
		warning: monthsToThreshold !== null && monthsToThreshold <= warnWithin,
		n
	};
}

/** Calendar months ending with the month of `asOf` (the last one runs to `asOf`). */
export function monthWindows(asOf: string, months: number) {
	const [year, month] = asOf.split('-').map(Number);
	return Array.from({ length: months }, (_, i) => {
		const k = months - 1 - i;
		const from = new Date(Date.UTC(year, month - 1 - k, 1)).toISOString().slice(0, 10);
		const end = new Date(Date.UTC(year, month - k, 0)).toISOString().slice(0, 10);
		return { month: from.slice(0, 7), from, to: k === 0 ? asOf : end };
	});
}

/**
 * Monthly resistant / tested counts for several drugs of one organism, first isolates of each
 * month (same rule as the trend chart). The records are narrowed to the filter once.
 */
export function monthlyResistance(
	records: IsolateRecord[],
	filter: IsolateFilter,
	codes: string[],
	asOf: string,
	months = 24
): Record<string, MonthCount[]> {
	const subset = records.filter((r) => matchesFilter(r, filter));
	const out: Record<string, MonthCount[]> = Object.fromEntries(codes.map((c) => [c, []]));
	for (const w of monthWindows(asOf, months)) {
		const list = selectIsolates(subset, {}, w);
		for (const code of codes) {
			let n = 0;
			let k = 0;
			for (const i of list) {
				const r = i.results[code];
				if (r === undefined) continue;
				n++;
				if (r !== 'S') k++;
			}
			out[code].push({ month: w.month, k, n });
		}
	}
	return out;
}
