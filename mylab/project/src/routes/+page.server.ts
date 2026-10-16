import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { firstIsolates } from '#lib/amr/firstIsolate.ts';
import { inRange, surveillanceWindows } from '#lib/amr/dates.ts';

export const load: PageServerLoad = async () => {
	const data = await getDataset();
	const { recent } = surveillanceWindows(data.lastDate);
	const recentFirst = firstIsolates(data.isolates.filter((i) => inRange(i.date, recent)));

	const byWard = data.wards.map((w) => {
		const isolates = recentFirst.filter((i) => i.ward === w.code);
		return {
			...w,
			isolates: isolates.length,
			hospitalOnset: isolates.filter((i) => i.hospitalOnset).length
		};
	});

	return {
		status: {
			totalCultures: data.totalCultures,
			totalIsolates: data.isolates.length,
			firstDate: data.firstDate,
			lastDate: data.lastDate,
			loadedAt: data.loadedAt.toISOString()
		},
		recent,
		byWard
	};
};
