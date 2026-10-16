import { inRange, type DateRange } from './dates';
import { firstIsolates } from './firstIsolate';
import { proportion, type Proportion } from './stats';
import type { AntibioticInfo, IsolateRecord, Sex, Specimen } from './types';

export interface IsolateFilter {
	/** Ward code, or undefined for every ward. */
	ward?: string;
	specimen?: Specimen;
	organism?: string;
	sex?: Sex;
	/** hospital = hospital-onset, community = everything else. */
	onset?: 'hospital' | 'community';
	ageMin?: number;
	ageMax?: number;
}

export function matchesFilter(record: IsolateRecord, f: IsolateFilter): boolean {
	return (
		(f.ward === undefined || record.ward === f.ward) &&
		(f.specimen === undefined || record.specimen === f.specimen) &&
		(f.organism === undefined || record.organism === f.organism) &&
		(f.sex === undefined || record.sex === f.sex) &&
		(f.onset === undefined || record.hospitalOnset === (f.onset === 'hospital')) &&
		(f.ageMin === undefined || record.age >= f.ageMin) &&
		(f.ageMax === undefined || record.age <= f.ageMax)
	);
}

/** First isolates matching the filter within the window. */
export function selectIsolates(
	records: IsolateRecord[],
	filter: IsolateFilter,
	window: DateRange
): IsolateRecord[] {
	return firstIsolates(records.filter((r) => inRange(r.date, window) && matchesFilter(r, filter)));
}

/** Share of tested isolates that are susceptible to one antibiotic. */
export function susceptibleShare(isolates: IsolateRecord[], code: string): Proportion {
	let tested = 0;
	let susceptible = 0;
	for (const i of isolates) {
		const r = i.results[code];
		if (r === undefined) continue;
		tested++;
		if (r === 'S') susceptible++;
	}
	return proportion(susceptible, tested);
}

export interface AntibiogramRow {
	organism: string;
	isolates: number;
	/** % susceptible keyed by antibiotic code; absent when the drug is not tested for this organism. */
	cells: Record<string, Proportion>;
}

/** Organism × antibiotic matrix of % susceptible, most frequent organisms first. */
export function antibiogram(
	isolates: IsolateRecord[],
	antibiotics: AntibioticInfo[]
): AntibiogramRow[] {
	const byOrganism = new Map<string, IsolateRecord[]>();
	for (const i of isolates) {
		let list = byOrganism.get(i.organism);
		if (!list) byOrganism.set(i.organism, (list = []));
		list.push(i);
	}
	return [...byOrganism.entries()]
		.map(([organism, list]) => {
			const cells: Record<string, Proportion> = {};
			for (const ab of antibiotics) {
				const share = susceptibleShare(list, ab.code);
				if (share.n > 0) cells[ab.code] = share;
			}
			return { organism, isolates: list.length, cells };
		})
		.sort((a, b) => b.isolates - a.isolates || a.organism.localeCompare(b.organism));
}

export interface TrendPoint {
	/** `YYYY-MM` */
	month: string;
	share: Proportion;
}

/** Monthly % susceptible over the `months` calendar months ending with the month of `asOf`. */
export function monthlyTrend(
	records: IsolateRecord[],
	filter: IsolateFilter,
	code: string,
	asOf: string,
	months = 24
): TrendPoint[] {
	const [year, month] = asOf.split('-').map(Number);
	const points: TrendPoint[] = [];
	for (let k = months - 1; k >= 0; k--) {
		const start = new Date(Date.UTC(year, month - 1 - k, 1));
		const end = new Date(Date.UTC(year, month - k, 0));
		const from = start.toISOString().slice(0, 10);
		const to = k === 0 ? asOf : end.toISOString().slice(0, 10);
		points.push({
			month: from.slice(0, 7),
			share: susceptibleShare(selectIsolates(records, filter, { from, to }), code)
		});
	}
	return points;
}

/**
 * True when the recent share is clearly below the reference: the recent interval lies entirely
 * under the reference estimate and the drop is at least `minDrop` (absolute).
 */
export function isSignificantDrop(
	recent: Proportion,
	reference: Proportion,
	minDrop = 0.1
): boolean {
	if (recent.p === null || reference.p === null || recent.high === null) return false;
	if (recent.n < 10 || reference.n < 30) return false;
	return reference.p - recent.p >= minDrop && recent.high < reference.p;
}
