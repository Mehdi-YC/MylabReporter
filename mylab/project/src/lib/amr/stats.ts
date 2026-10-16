/** Minimum number of isolates before a percentage is reported (CLSI M39 / Finres). */
export const MIN_ISOLATES = 30;

export interface Proportion {
	k: number;
	n: number;
	/** k / n, or null when n is 0. */
	p: number | null;
	low: number | null;
	high: number | null;
	/** n ≥ MIN_ISOLATES. */
	reliable: boolean;
}

/** Wilson score interval: well behaved for small n and proportions near 0 or 1. */
export function proportion(k: number, n: number, z = 1.96): Proportion {
	if (n === 0) return { k, n, p: null, low: null, high: null, reliable: false };
	const p = k / n;
	const z2 = z * z;
	const denom = 1 + z2 / n;
	const centre = (p + z2 / (2 * n)) / denom;
	const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
	return {
		k,
		n,
		p,
		low: Math.max(0, centre - half),
		high: Math.min(1, centre + half),
		reliable: n >= MIN_ISOLATES
	};
}

/** P(X ≥ k) for X ~ Poisson(lambda). */
export function poissonUpperTail(k: number, lambda: number): number {
	if (k <= 0) return 1;
	if (lambda <= 0) return 0;
	// 1 - P(X ≤ k-1); lambda stays small (weekly counts) so the direct sum is stable.
	let term = Math.exp(-lambda);
	let cdf = term;
	for (let i = 1; i < k; i++) {
		term *= lambda / i;
		cdf += term;
	}
	return Math.max(0, 1 - cdf);
}

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function binomialUpperTail(k: number, n: number, p: number): number {
	if (k <= 0) return 1;
	if (k > n) return 0;
	if (p <= 0) return 0;
	if (p >= 1) return 1;
	// Sum the upper tail from P(X = k), built in log space to avoid underflow for large n.
	let logPmf = logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
	let tail = 0;
	for (let i = k; i <= n; i++) {
		tail += Math.exp(logPmf);
		logPmf += Math.log((n - i) / (i + 1)) + Math.log(p / (1 - p));
	}
	return Math.min(1, tail);
}

function logChoose(n: number, k: number): number {
	let s = 0;
	for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i);
	return s;
}

export function mean(values: number[]): number {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function standardDeviation(values: number[]): number {
	if (values.length < 2) return 0;
	const m = mean(values);
	return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}
