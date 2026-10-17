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

export interface BulletinWeek extends DateRange {
	year: number;
	week: number;
}

/** ISO year and week number of a date. */
export function isoWeekOf(iso: string): { year: number; week: number } {
	const d = new Date(`${iso}T00:00:00Z`);
	// Move to the Thursday of the same week: its year is the ISO year.
	d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
	const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
	return {
		year: d.getUTCFullYear(),
		week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
	};
}

/** The last complete ISO week (Monday–Sunday) on or before the date: what a Monday bulletin covers. */
export function lastCompleteWeek(asOf: string): BulletinWeek {
	const monday = weekStart(asOf);
	const to = addDays(monday, 6) === asOf ? asOf : addDays(monday, -1);
	const from = addDays(to, -6);
	return { from, to, ...isoWeekOf(from) };
}
