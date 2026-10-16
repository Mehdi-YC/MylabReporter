const DAY_MS = 86_400_000;

/** Days since the Unix epoch for an ISO `YYYY-MM-DD` date (UTC, no timezone drift). */
export function dayNumber(iso: string): number {
	return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function fromDayNumber(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
	return fromDayNumber(dayNumber(iso) + days);
}

/** Inclusive date range `[from, to]`. */
export interface DateRange {
	from: string;
	to: string;
}

/** The surveillance windows shown side by side: the last 4 weeks and the last 12 months. */
export function surveillanceWindows(asOf: string): { recent: DateRange; annual: DateRange } {
	return {
		recent: { from: addDays(asOf, -27), to: asOf },
		annual: { from: addDays(asOf, -364), to: asOf }
	};
}

export function inRange(iso: string, range: DateRange): boolean {
	return iso >= range.from && iso <= range.to;
}

/** Monday of the ISO week containing the date. */
export function weekStart(iso: string): string {
	const day = dayNumber(iso);
	// 1970-01-01 was a Thursday → (day + 3) % 7 is 0 on Mondays.
	return fromDayNumber(day - ((day + 3) % 7));
}
