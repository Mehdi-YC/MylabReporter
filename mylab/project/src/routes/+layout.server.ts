import type { LayoutServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { getAlerts } from '#lib/server/amr/alerts.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	const data = await getDataset();
	const alerts = getAlerts(data);
	return {
		locale: locals.locale,
		sync: { lastDate: data.lastDate, loadedAt: data.loadedAt.toISOString() },
		openAlerts: {
			total: alerts.length,
			critical: alerts.filter((a) => a.severity === 'critical').length
		}
	};
};
