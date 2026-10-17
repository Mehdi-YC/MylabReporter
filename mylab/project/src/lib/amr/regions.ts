import { matchesFilter, type IsolateFilter } from './antibiogram';
import { inRange, type DateRange } from './dates';
import { firstIsolates } from './firstIsolate';
import { proportion, type Proportion } from './stats';
import type { IsolateRecord } from './types';

/**
 * Patients' home areas in the synthetic extract: five abstract areas around one hospital (Tyks,
 * Turku). They are not real municipalities.
 */
export const HOME_AREAS = ['North', 'West', 'Centre', 'East', 'South'] as const;
export type HomeArea = (typeof HOME_AREAS)[number];

export const REGION_INDICATORS = {
	resistance: { label: '% resistant to the selected antibiotic', unit: '%' },
	esbl: { label: '% ESBL producers', unit: '%' },
	mrsa: { label: '% MRSA among S. aureus', unit: '%' },
	isolates: { label: 'First isolates', unit: '' }
} as const;
export type RegionIndicator = keyof typeof REGION_INDICATORS;

export interface AreaValue {
	area: string;
	/** First isolates of the selection in the area. */
	isolates: number;
	/** Share for the percentage indicators (k / n), null for counts. */
	share: Proportion | null;
	/** Value shown on the map: % (0–100) or a count; null when nothing was tested. */
	value: number | null;
	/** Percentages need ≥ 30 isolates; counts are always shown. */
	reliable: boolean;
}

/**
 * One value per home area for the selection: first isolates (per patient, organism and specimen)
 * within the window, then the indicator. Areas with no isolate still appear, with value null.
 */
export function regionalIndicator(
	records: IsolateRecord[],
	filter: IsolateFilter,
	window: DateRange,
	indicator: RegionIndicator,
	antibiotic?: string
): AreaValue[] {
	// MRSA is defined on S. aureus whatever organism is selected.
	const f = indicator === 'mrsa' ? { ...filter, organism: 'Staphylococcus aureus' } : filter;
	const selected = firstIsolates(
		records.filter((r) => inRange(r.date, window) && matchesFilter(r, f))
	);
	const areas = [...new Set([...HOME_AREAS, ...selected.map((r) => r.homeArea)])];

	return areas.map((area) => {
		const list = selected.filter((r) => r.homeArea === area);
		if (indicator === 'isolates')
			return { area, isolates: list.length, share: null, value: list.length, reliable: true };
		let share: Proportion;
		if (indicator === 'resistance') {
			const tested = list.filter((r) => antibiotic && r.results[antibiotic] !== undefined);
			share = proportion(
				tested.filter((r) => r.results[antibiotic!] === 'R').length,
				tested.length
			);
		} else {
			share = proportion(list.filter((r) => r[indicator]).length, list.length);
		}
		return {
			area,
			isolates: list.length,
			share,
			value: share.p === null ? null : share.p * 100,
			reliable: share.reliable
		};
	});
}
