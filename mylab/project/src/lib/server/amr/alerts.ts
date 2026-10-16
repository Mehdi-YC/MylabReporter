import { alertTimeline, DEFAULT_OPTIONS, type TimelineWeek } from '#lib/amr/anomalies.ts';
import { addDays } from '#lib/amr/dates.ts';
import type { Dataset } from './dataset.ts';

let cache: { version: string; weeks: TimelineWeek[] } | null = null;

/**
 * Weekly alert history, as the tool would have raised it live. The first weeks are skipped
 * until a full baseline year is available. Cached per dataset version (~3 s to compute).
 */
export function getAlertTimeline(data: Dataset): TimelineWeek[] {
	if (cache?.version === data.version) return cache.weeks;
	const from = addDays(data.firstDate, DEFAULT_OPTIONS.baselineDays + DEFAULT_OPTIONS.recentDays);
	const weeks = alertTimeline(data.isolates, from, data.lastDate);
	cache = { version: data.version, weeks };
	return weeks;
}
