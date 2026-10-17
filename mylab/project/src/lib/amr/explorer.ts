import { selectIsolates, type IsolateFilter } from './antibiogram';
import type { DateRange } from './dates';
import { proportion, type Proportion } from './stats';
import type { IsolateRecord } from './types';

export interface ExplorerCell {
	code: string;
	/** Share of tested first isolates that are RESISTANT, with its Wilson interval. */
	recent: Proportion;
	annual: Proportion;
}

export interface ExplorerRow {
	ward: string;
	cells: ExplorerCell[];
}

function resistant(isolates: IsolateRecord[], code: string): Proportion {
	let tested = 0;
	let r = 0;
	for (const i of isolates) {
		const result = i.results[code];
		if (result === undefined) continue;
		tested++;
		if (result === 'R') r++;
	}
	return proportion(r, tested);
}

/**
 * Ward × antibiotic resistance matrix for one organism (and optional specimen / onset),
 * last 4 weeks and last 12 months, first isolates per window.
 */
export function explorerMatrix(
	records: IsolateRecord[],
	wards: string[],
	codes: string[],
	filter: IsolateFilter,
	windows: { recent: DateRange; annual: DateRange }
): ExplorerRow[] {
	return wards.map((ward) => {
		const annual = selectIsolates(records, { ...filter, ward }, windows.annual);
		const recent = selectIsolates(records, { ...filter, ward }, windows.recent);
		return {
			ward,
			cells: codes.map((code) => ({
				code,
				recent: resistant(recent, code),
				annual: resistant(annual, code)
			}))
		};
	});
}
