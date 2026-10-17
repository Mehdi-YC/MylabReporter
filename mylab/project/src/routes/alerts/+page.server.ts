import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { getAlerts, getAlertTimeline } from '#lib/server/amr/alerts.ts';
import { wardLevels } from '#lib/amr/anomalies.ts';
import { rankAlerts } from '#lib/amr/triage.ts';

export const load: PageServerLoad = async ({ url }) => {
	const data = await getDataset();
	const timeline = getAlertTimeline(data);

	const requested = url.searchParams.get('asOf');
	const asOf =
		requested && requested >= timeline[0].asOf && requested <= data.lastDate
			? requested
			: data.lastDate;

	const alerts = getAlerts(data, asOf);
	const ranked = rankAlerts(alerts);

	return {
		asOf,
		lastDate: data.lastDate,
		wards: data.wards,
		antibiotics: data.antibiotics.map((a) => ({ code: a.code, name: a.name, nameFi: a.nameFi })),
		alerts: ranked.map((r) => r.alert),
		linked: Object.fromEntries(
			ranked.filter((r) => r.linkedTo).map((r) => [r.alert.id, r.linkedTo!])
		),
		wardStatus: wardLevels(alerts),
		timeline
	};
};
