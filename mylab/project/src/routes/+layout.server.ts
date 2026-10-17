import type { LayoutServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { getAlerts } from '#lib/server/amr/alerts.ts';
import { bulletinSummaries, bulletinWard } from '#lib/server/amr/bulletin.ts';

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	const data = await getDataset();
	const alerts = getAlerts(data);
	// The bell's two weekly bulletins follow the date and ward being looked at.
	const requested = url.searchParams.get('asOf');
	const asOf =
		requested && requested >= data.firstDate && requested <= data.lastDate
			? requested
			: data.lastDate;
	return {
		locale: locals.locale,
		sync: { lastDate: data.lastDate, loadedAt: data.loadedAt.toISOString() },
		openAlerts: {
			total: alerts.length,
			critical: alerts.filter((a) => a.severity === 'critical').length
		},
		bulletins: bulletinSummaries(data, asOf, bulletinWard(data, url, cookies, asOf))
	};
};
