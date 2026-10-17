import {
	isSignificantDrop,
	selectIsolates,
	susceptibleShare,
	type IsolateFilter
} from './antibiogram';
import type { DateRange } from './dates';
import type { Proportion } from './stats';
import type { AntibioticInfo, IsolateRecord } from './types';

/** Resistance rate of one organism × drug in one window. */
export interface RateCell {
	/** % resistant among tested first isolates, null when none was tested. */
	r: number | null;
	n: number;
	reliable: boolean;
}

export interface PulseCell {
	code: string;
	recent: RateCell;
	annual: RateCell;
	/** Recent susceptibility significantly below the ward's own 12 months (= resistance rise). */
	rise: boolean;
}

export interface PulseRow {
	organism: string;
	recentIsolates: number;
	annualIsolates: number;
	cells: PulseCell[];
}

export interface PulseTable {
	antibiotics: string[];
	rows: PulseRow[];
	/** Largest significant rise (recent R % − annual R %), if any. */
	topRise: { organism: string; code: string; recent: number; annual: number } | null;
}

function rate(share: Proportion): RateCell {
	return {
		r: share.p === null ? null : Math.round((1 - share.p) * 1000) / 10,
		n: share.n,
		reliable: share.reliable
	};
}

/**
 * Ward pulse table: the most frequent organisms of the selection, each with its resistance
 * rate per drug over the last 4 weeks and the last 12 months (first isolates of each window).
 */
export function pulseTable(
	records: IsolateRecord[],
	antibiotics: AntibioticInfo[],
	filter: IsolateFilter,
	windows: { recent: DateRange; annual: DateRange },
	maxOrganisms = 5
): PulseTable {
	const annual = selectIsolates(records, filter, windows.annual);
	const recent = selectIsolates(records, filter, windows.recent);
	const counts = new Map<string, number>();
	for (const i of annual) counts.set(i.organism, (counts.get(i.organism) ?? 0) + 1);
	const organisms = [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, maxOrganisms)
		.map(([o]) => o);

	// Urinary agents only for urine; screening agents (cefoxitin) are not treatment options.
	const codes = antibiotics
		.filter((a) => (a.reportedFor === 'all' || filter.specimen === 'urine') && a.code !== 'FOX')
		.map((a) => a.code)
		.filter((code) => annual.some((i) => i.results[code] !== undefined));

	let topRise: PulseTable['topRise'] = null;
	const rows = organisms.map((organism) => {
		const a = annual.filter((i) => i.organism === organism);
		const r = recent.filter((i) => i.organism === organism);
		return {
			organism,
			annualIsolates: a.length,
			recentIsolates: r.length,
			cells: codes.map((code) => {
				const recentShare = susceptibleShare(r, code);
				const annualShare = susceptibleShare(a, code);
				const cell = {
					code,
					recent: rate(recentShare),
					annual: rate(annualShare),
					rise: isSignificantDrop(recentShare, annualShare)
				};
				if (cell.rise && cell.recent.r !== null && cell.annual.r !== null) {
					const delta = cell.recent.r - cell.annual.r;
					if (!topRise || delta > topRise.recent - topRise.annual)
						topRise = { organism, code, recent: cell.recent.r, annual: cell.annual.r };
				}
				return cell;
			})
		};
	});
	return { antibiotics: codes, rows, topRise };
}

/** Weekly counts over the `weeks` weeks ending at `asOf` (first isolates of each week). */
export function weeklyCounts(
	records: IsolateRecord[],
	filter: IsolateFilter,
	asOf: string,
	count: (isolates: IsolateRecord[]) => number,
	weeks = 16
): { to: string; value: number }[] {
	const day = 86_400_000;
	const end = Date.parse(`${asOf}T00:00:00Z`);
	const out: { to: string; value: number }[] = [];
	for (let k = weeks - 1; k >= 0; k--) {
		const to = new Date(end - 7 * k * day).toISOString().slice(0, 10);
		const from = new Date(end - (7 * k + 6) * day).toISOString().slice(0, 10);
		out.push({ to, value: count(selectIsolates(records, filter, { from, to })) });
	}
	return out;
}
