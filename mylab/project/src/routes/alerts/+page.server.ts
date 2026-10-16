import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { getAlertTimeline } from '#lib/server/amr/alerts.ts';
import { detectAnomalies, wardLevels } from '#lib/amr/anomalies.ts';

export const load: PageServerLoad = async ({ url }) => {
	const data = await getDataset();
	const timeline = getAlertTimeline(data);

	const requested = url.searchParams.get('asOf');
	const asOf =
		requested && requested >= timeline[0].asOf && requested <= data.lastDate
			? requested
			: data.lastDate;

	const alerts = detectAnomalies(data.isolates, asOf);

	return {
		asOf,
		lastDate: data.lastDate,
		wards: data.wards,
		antibiotics: data.antibiotics.map((a) => ({ code: a.code, name: a.name })),
		alerts,
		wardStatus: wardLevels(alerts),
		timeline
	};
};
