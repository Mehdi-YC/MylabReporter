import type { Cookies } from '@sveltejs/kit';
import { getAlerts } from '#lib/server/amr/alerts.ts';
import type { Dataset } from '#lib/server/amr/dataset.ts';
import { loadWardPulse } from '#lib/server/amr/pulse.ts';
import { rememberedWard } from '#lib/server/ward.ts';
import { selectIsolates } from '#lib/amr/antibiogram.ts';
import { wardLevels, type Alert } from '#lib/amr/anomalies.ts';
import { addDays, lastCompleteWeek } from '#lib/amr/dates.ts';
import { rankAlerts } from '#lib/amr/triage.ts';

/**
 * Weekly bulletins: what the tool would send every Monday, one per ward for the clinicians
 * and one for the whole hospital for infection control. Built from the same computations as
 * the pages (no language model), for the 7 days ending on the reference date.
 */
export type BulletinKind = 'ward' | 'hospital';

export type { BulletinWeek } from '#lib/amr/dates.ts';
export const bulletinWeek = lastCompleteWeek;

/** Same signal on two dates (alert ids depend on the window, this does not). */
const alertKey = (a: Alert) =>
	[a.kind, a.ward, a.phenotype ?? '', a.organism ?? '', a.antibiotic ?? ''].join('|');

/** Keys of the alerts already active a week earlier: the others are new this week. */
function previousKeys(data: Dataset, asOf: string): Set<string> {
	const before = addDays(asOf, -7);
	if (before < data.firstDate) return new Set();
	return new Set(getAlerts(data, before).map(alertKey));
}

/** The slice of an alert the bulletin texts need (see AlertLike), plus its triage links. */
function slim(a: Alert, isNew: boolean, linkedTo: string | null) {
	return {
		id: a.id,
		kind: a.kind,
		severity: a.severity,
		ward: a.ward,
		phenotype: a.phenotype ?? null,
		organism: a.organism ?? null,
		antibiotic: a.antibiotic ?? null,
		observed: a.observed,
		expected: a.expected,
		n: a.n ?? null,
		pValue: a.pValue,
		investigation: a.investigation,
		cases: a.cases.length,
		isNew,
		linkedTo
	};
}
export type BulletinAlert = ReturnType<typeof slim>;

function rankedSlim(data: Dataset, alerts: Alert[], asOf: string): BulletinAlert[] {
	const before = previousKeys(data, asOf);
	return rankAlerts(alerts).map((r) => slim(r.alert, !before.has(alertKey(r.alert)), r.linkedTo));
}

/** The ward a bulletin is for: the page's, else the one chosen last, else the most urgent. */
export function bulletinWard(data: Dataset, url: URL, cookies: Cookies, asOf: string): string {
	const codes = data.wards.map((w) => w.code);
	const requested = url.searchParams.get('ward');
	if (requested && codes.includes(requested)) return requested;
	const urgent = [...getAlerts(data, asOf)].sort(
		(a, b) => Number(a.severity !== 'critical') - Number(b.severity !== 'critical')
	)[0];
	return rememberedWard(cookies, codes) ?? urgent?.ward ?? codes[0];
}

/** Header bell: one line for each of the two bulletins of the week. */
export function bulletinSummaries(data: Dataset, asOf: string, ward: string) {
	const week = bulletinWeek(asOf);
	const alerts = getAlerts(data, asOf);
	const before = previousKeys(data, asOf);
	const wardAlerts = rankAlerts(alerts.filter((a) => a.ward === ward)).filter((r) => !r.linkedTo);
	const headline = wardAlerts[0]?.alert;
	const info = data.wards.find((w) => w.code === ward);
	const drug = data.antibiotics.find((x) => x.code === headline?.antibiotic);
	return {
		asOf,
		week,
		ward: {
			code: ward,
			nameFi: info?.nameFi ?? ward,
			nameEn: info?.nameEn ?? ward,
			antibiotic: drug ? { name: drug.name, nameFi: drug.nameFi } : null,
			alerts: wardAlerts.length,
			critical: wardAlerts.filter((r) => r.alert.severity === 'critical').length,
			headline: headline ? slim(headline, !before.has(alertKey(headline)), null) : null
		},
		hospital: (() => {
			// Events, not signals: rises with the same patients count with their cluster.
			const events = rankAlerts(alerts)
				.filter((r) => !r.linkedTo)
				.map((r) => r.alert);
			return {
				alerts: events.length,
				critical: events.filter((a) => a.severity === 'critical').length,
				newAlerts: events.filter((a) => !before.has(alertKey(a))).length,
				wards: new Set(events.map((a) => a.ward)).size
			};
		})()
	};
}
export type BulletinSummaries = ReturnType<typeof bulletinSummaries>;

/** First isolates of the bulletin week and of the week before, for a ward or all wards. */
function weeklyVolume(data: Dataset, asOf: string, ward?: string) {
	const week = bulletinWeek(asOf);
	const previous = { from: addDays(week.from, -7), to: addDays(week.to, -7) };
	return {
		thisWeek: selectIsolates(data.isolates, { ward }, week).length,
		previousWeek: selectIsolates(data.isolates, { ward }, previous).length
	};
}

/** Everything the ward bulletin shows: the ward pulse of the date, plus its alerts. */
export async function wardBulletin(data: Dataset, url: URL, cookies: Cookies, asOf: string) {
	const ward = bulletinWard(data, url, cookies, asOf);
	const pulseUrl = new URL(url);
	pulseUrl.search = new URLSearchParams({ ward, asOf }).toString();
	const pulse = await loadWardPulse(pulseUrl, cookies);
	return {
		kind: 'ward' as const,
		ward,
		week: bulletinWeek(asOf),
		alerts: rankedSlim(
			data,
			getAlerts(data, asOf).filter((a) => a.ward === ward),
			asOf
		),
		volume: weeklyVolume(data, asOf, ward),
		specimen: pulse.input.specimen,
		empiric: pulse.empiric,
		warned: pulse.warned,
		changes: pulse.changes,
		early: pulse.early.map((e) => ({
			organism: e.organism,
			code: e.code,
			current: e.current,
			slope: e.slope,
			monthsToThreshold: e.monthsToThreshold,
			warning: e.warning
		}))
	};
}

/** Everything the hospital bulletin shows, for infection control. */
export function hospitalBulletin(data: Dataset, asOf: string) {
	const alerts = getAlerts(data, asOf);
	return {
		kind: 'hospital' as const,
		week: bulletinWeek(asOf),
		alerts: rankedSlim(data, alerts, asOf),
		levels: wardLevels(alerts),
		volume: weeklyVolume(data, asOf)
	};
}
