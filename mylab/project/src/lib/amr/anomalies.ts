import { addDays, inRange, type DateRange } from './dates';
import { firstIsolates } from './firstIsolate';
import { binomialUpperTail, poissonUpperTail } from './stats';
import { PHENOTYPES, type IsolateRecord, type Phenotype, type Specimen } from './types';

export type Severity = 'critical' | 'warning';
export type AlertKind = 'sentinel' | 'phenotype-cluster' | 'resistance-rise' | 'organism-surge';

export interface AlertCase {
	isolateId: string;
	date: string;
	patientId: string;
	ward: string;
	organism: string;
	specimen: Specimen;
	hospitalOnset: boolean;
}

export interface Alert {
	id: string;
	kind: AlertKind;
	severity: Severity;
	ward: string;
	organism?: string;
	antibiotic?: string;
	phenotype?: Phenotype;
	/** Count (clusters, surges) or % resistant (resistance rise) in the recent window. */
	observed: number;
	/** Expected count or baseline % resistant. */
	expected: number;
	/** Isolates tested, for resistance rises. */
	n?: number;
	pValue: number;
	window: DateRange;
	cases: AlertCase[];
	investigation: Investigation;
}

/** Automatic first look at the cases, like an infection-control nurse would do. */
export interface Investigation {
	hospitalOnset: number;
	/** Largest group of cases sharing an identical S/R profile (proxy for clonal spread). */
	sameProfile: number;
	firstSeen: string;
	lastSeen: string;
}

export interface DetectionOptions {
	/** Length of the "recent" window, days. */
	recentDays: number;
	/** Length of the baseline period that ends where the recent window starts, days. */
	baselineDays: number;
	/** Poisson p-value for a phenotype-cluster warning and for a critical alert. */
	warnP: number;
	criticalP: number;
	/**
	 * Stricter p-values for detectors that run many tests per ward (every organism, every
	 * organism × drug), to keep the false-alarm rate down.
	 */
	surgeP: number;
	riseP: number;
	/** Lower bound for the expected count, so a zero baseline does not make every case "significant". */
	minExpected: number;
	minClusterCases: number;
	/** Resistance rise: minimum isolates tested recently, at baseline, and minimum rise (absolute). */
	minRecentTested: number;
	minBaselineTested: number;
	minRise: number;
	/** Organism surge: minimum cases and observed / expected ratio. */
	minSurgeCases: number;
	minSurgeRatio: number;
}

export const DEFAULT_OPTIONS: DetectionOptions = {
	recentDays: 28,
	baselineDays: 364,
	warnP: 0.001,
	criticalP: 0.00001,
	surgeP: 0.00001,
	riseP: 0.0001,
	minExpected: 0.5,
	minClusterCases: 3,
	minRecentTested: 10,
	minBaselineTested: 30,
	minRise: 0.2,
	minSurgeCases: 8,
	minSurgeRatio: 2.5
};

/** CPE and VRE are rare enough in Finland that a single case warrants an alert. */
const SENTINEL: Phenotype[] = ['cpe', 'vre'];

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const item of items) {
		const k = key(item);
		let list = map.get(k);
		if (!list) map.set(k, (list = []));
		list.push(item);
	}
	return map;
}

function investigate(cases: IsolateRecord[]): Investigation {
	const profiles = groupBy(cases, (c) =>
		Object.entries(c.results)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([code, r]) => `${code}${r}`)
			.join('')
	);
	const dates = cases.map((c) => c.date).sort();
	return {
		hospitalOnset: cases.filter((c) => c.hospitalOnset).length,
		sameProfile: Math.max(0, ...[...profiles.values()].map((g) => g.length)),
		firstSeen: dates[0],
		lastSeen: dates[dates.length - 1]
	};
}

function toCases(records: IsolateRecord[]): AlertCase[] {
	return records.map((r) => ({
		isolateId: r.isolateId,
		date: r.date,
		patientId: r.patientId,
		ward: r.ward,
		organism: r.organism,
		specimen: r.specimen,
		hospitalOnset: r.hospitalOnset
	}));
}

/**
 * Runs every detector for the window ending at `asOf`. Records must cover at least
 * `baselineDays + recentDays` before `asOf`; later records are ignored.
 */
export function detectAnomalies(
	records: IsolateRecord[],
	asOf: string,
	options: Partial<DetectionOptions> = {}
): Alert[] {
	const o = { ...DEFAULT_OPTIONS, ...options };
	const recentWindow: DateRange = { from: addDays(asOf, -(o.recentDays - 1)), to: asOf };
	const baselineWindow: DateRange = {
		from: addDays(recentWindow.from, -o.baselineDays),
		to: addDays(recentWindow.from, -1)
	};
	const scale = o.recentDays / o.baselineDays;

	const recent = firstIsolates(records.filter((r) => inRange(r.date, recentWindow)));
	const baseline = firstIsolates(records.filter((r) => inRange(r.date, baselineWindow)));
	const recentByWard = groupBy(recent, (r) => r.ward);
	const baselineByWard = groupBy(baseline, (r) => r.ward);

	const alerts: Alert[] = [];
	const severityOf = (p: number): Severity | null =>
		p < o.criticalP ? 'critical' : p < o.warnP ? 'warning' : null;

	for (const [ward, wardRecent] of recentByWard) {
		const wardBaseline = baselineByWard.get(ward) ?? [];

		// 1. Resistant phenotypes: sentinel cases and clusters.
		for (const phenotype of PHENOTYPES) {
			const cases = wardRecent.filter((r) => r[phenotype]);
			if (cases.length === 0) continue;
			const expected = wardBaseline.filter((r) => r[phenotype]).length * scale;
			const pValue = poissonUpperTail(cases.length, Math.max(expected, o.minExpected));
			const clusterSeverity = cases.length >= o.minClusterCases ? severityOf(pValue) : null;

			if (clusterSeverity || SENTINEL.includes(phenotype)) {
				alerts.push({
					id: `${clusterSeverity ? 'phenotype-cluster' : 'sentinel'}:${ward}:${phenotype}`,
					kind: clusterSeverity ? 'phenotype-cluster' : 'sentinel',
					severity: SENTINEL.includes(phenotype) ? 'critical' : clusterSeverity!,
					ward,
					phenotype,
					organism: cases.length === 1 ? cases[0].organism : undefined,
					observed: cases.length,
					expected,
					pValue,
					window: recentWindow,
					cases: toCases(cases),
					investigation: investigate(cases)
				});
			}
		}

		// 2. Organism surge: many more isolates of one species than usual.
		const baselineByOrganism = groupBy(wardBaseline, (r) => r.organism);
		for (const [organism, cases] of groupBy(wardRecent, (r) => r.organism)) {
			const expected = (baselineByOrganism.get(organism)?.length ?? 0) * scale;
			if (cases.length < o.minSurgeCases || cases.length < o.minSurgeRatio * expected) continue;
			const pValue = poissonUpperTail(cases.length, Math.max(expected, o.minExpected));
			if (pValue >= o.surgeP) continue;
			alerts.push({
				id: `organism-surge:${ward}:${organism}`,
				kind: 'organism-surge',
				severity: 'warning',
				ward,
				organism,
				observed: cases.length,
				expected,
				pValue,
				window: recentWindow,
				cases: toCases(cases),
				investigation: investigate(cases)
			});
		}

		// 3. Resistance rise: % resistant to one drug well above the ward's own baseline.
		for (const [organism, cases] of groupBy(wardRecent, (r) => r.organism)) {
			const base = baselineByOrganism.get(organism) ?? [];
			const codes = new Set(cases.flatMap((c) => Object.keys(c.results)));
			for (const code of codes) {
				const tested = cases.filter((c) => c.results[code] !== undefined);
				const baseTested = base.filter((c) => c.results[code] !== undefined);
				if (tested.length < o.minRecentTested || baseTested.length < o.minBaselineTested) continue;
				const resistant = tested.filter((c) => c.results[code] === 'R');
				const pBase = baseTested.filter((c) => c.results[code] === 'R').length / baseTested.length;
				const pRecent = resistant.length / tested.length;
				if (pRecent - pBase < o.minRise) continue;
				// Floor the baseline so a drug that was never resistant does not produce p ≈ 0.
				const pValue = binomialUpperTail(resistant.length, tested.length, Math.max(pBase, 0.02));
				if (pValue >= o.riseP) continue;
				alerts.push({
					id: `resistance-rise:${ward}:${organism}:${code}`,
					kind: 'resistance-rise',
					severity: 'warning',
					ward,
					organism,
					antibiotic: code,
					observed: pRecent,
					expected: pBase,
					n: tested.length,
					pValue,
					window: recentWindow,
					cases: toCases(resistant),
					investigation: investigate(resistant)
				});
			}
		}
	}

	const rank: Record<Severity, number> = { critical: 0, warning: 1 };
	return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.pValue - b.pValue);
}

/**
 * Ward status for maps and the timeline. An isolated sentinel case is shown apart from
 * outbreaks so that one CPE does not look like a ward-wide cluster.
 */
export type WardLevel = 'critical' | 'warning' | 'sentinel';

/** Highest level per ward with at least one alert. */
export function wardLevels(alerts: Alert[]): Record<string, WardLevel> {
	const rank: Record<WardLevel, number> = { critical: 0, warning: 1, sentinel: 2 };
	const levels: Record<string, WardLevel> = {};
	for (const a of alerts) {
		const level: WardLevel = a.kind === 'sentinel' ? 'sentinel' : a.severity;
		const current = levels[a.ward];
		if (!current || rank[level] < rank[current]) levels[a.ward] = level;
	}
	return levels;
}

export interface TimelineWeek {
	asOf: string;
	critical: number;
	warning: number;
	wards: Record<string, WardLevel>;
}

/** Runs the detectors at the end of every week, as the tool would have done live. */
export function alertTimeline(
	records: IsolateRecord[],
	from: string,
	to: string,
	options: Partial<DetectionOptions> = {}
): TimelineWeek[] {
	const weeks: TimelineWeek[] = [];
	for (let asOf = to; asOf >= from; asOf = addDays(asOf, -7)) {
		const alerts = detectAnomalies(records, asOf, options);
		weeks.push({
			asOf,
			critical: alerts.filter((a) => a.severity === 'critical').length,
			warning: alerts.filter((a) => a.severity === 'warning').length,
			wards: wardLevels(alerts)
		});
	}
	return weeks.reverse();
}
