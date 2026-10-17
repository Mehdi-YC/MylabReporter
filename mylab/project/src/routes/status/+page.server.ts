import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db/index.ts';
import { getDataset, REFRESH_MS } from '#lib/server/amr/dataset.ts';
import { addDays, inRange } from '#lib/amr/dates.ts';

async function count(query: ReturnType<typeof sql>): Promise<number> {
	const [row] = await db.all<{ n: number }>(query);
	return Number(row?.n ?? 0);
}

export const load: PageServerLoad = async () => {
	const data = await getDataset();
	const today = new Date().toISOString().slice(0, 10);
	const week = { from: addDays(data.lastDate, -6), to: data.lastDate };

	// Quality checks run against the canonical tables, as an ingestion job would after each load.
	const [unknownAntibiotics, unknownWards, futureDates, orphanResults, cultures7, guidelines] =
		await Promise.all([
			count(
				sql`select count(*) as n from susceptibility s left join antibiotic a on a.code = s.antibiotic_code where a.code is null`
			),
			count(
				sql`select count(*) as n from culture c left join ward w on w.code = c.ward_code where w.code is null`
			),
			count(sql`select count(*) as n from culture where sample_date > ${today}`),
			count(
				sql`select count(*) as n from susceptibility s left join isolate i on i.id = s.isolate_id where i.id is null`
			),
			count(
				sql`select count(*) as n from culture where sample_date >= ${week.from} and sample_date <= ${week.to}`
			),
			db.all<{ g: string }>(sql`select distinct guideline as g from susceptibility order by g`)
		]);

	let results = 0;
	let results7 = 0;
	for (const i of data.isolates) {
		const n = Object.keys(i.results).length;
		results += n;
		if (inRange(i.date, week)) results7 += n;
	}

	const checks = [
		{ key: 'antibiotics' as const, ok: unknownAntibiotics === 0, value: unknownAntibiotics },
		{ key: 'wards' as const, ok: unknownWards === 0, value: unknownWards },
		{ key: 'dates' as const, ok: futureDates === 0, value: futureDates },
		{ key: 'orphans' as const, ok: orphanResults === 0, value: orphanResults }
	];

	return {
		totals: {
			cultures: data.totalCultures,
			isolates: data.isolates.length,
			results,
			results7,
			cultures7,
			wards: data.wards.length,
			antibiotics: data.antibiotics.length,
			organisms: data.organisms.length
		},
		firstDate: data.firstDate,
		lastDate: data.lastDate,
		loadedAt: data.loadedAt.toISOString(),
		version: data.version,
		refreshSeconds: REFRESH_MS / 1000,
		checks,
		guidelines: guidelines.map((g) => g.g)
	};
};
