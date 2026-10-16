import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import {
	antibiogram,
	isSignificantDrop,
	monthlyTrend,
	selectIsolates,
	type IsolateFilter
} from '#lib/amr/antibiogram.ts';
import { surveillanceWindows } from '#lib/amr/dates.ts';
import type { Sex, Specimen } from '#lib/amr/types.ts';

const SPECIMENS: Specimen[] = ['urine', 'blood', 'wound'];

export const load: PageServerLoad = async ({ url }) => {
	const data = await getDataset();
	const q = url.searchParams;

	const pick = <T extends string>(key: string, allowed: readonly T[]) => {
		const v = q.get(key);
		return allowed.includes(v as T) ? (v as T) : undefined;
	};

	const filter: IsolateFilter = {
		ward: pick(
			'ward',
			data.wards.map((w) => w.code)
		),
		specimen: pick('specimen', SPECIMENS) ?? 'urine',
		sex: pick('sex', ['F', 'M'] as Sex[]),
		onset: pick('onset', ['hospital', 'community'] as const)
	};
	const requestedAsOf = q.get('asOf');
	const asOf =
		requestedAsOf && requestedAsOf >= data.firstDate && requestedAsOf <= data.lastDate
			? requestedAsOf
			: data.lastDate;

	const { recent, annual } = surveillanceWindows(asOf);
	// Urinary agents are only reported for urine samples.
	const antibiotics = data.antibiotics.filter(
		(a) => a.reportedFor === 'all' || filter.specimen === 'urine'
	);

	const recentRows = antibiogram(selectIsolates(data.isolates, filter, recent), antibiotics);
	const annualRows = antibiogram(selectIsolates(data.isolates, filter, annual), antibiotics);
	// Hospital-wide reference with the same filters, shown when a ward has too few isolates.
	const hospitalRows = filter.ward
		? antibiogram(
				selectIsolates(data.isolates, { ...filter, ward: undefined }, annual),
				antibiotics
			)
		: annualRows;

	const rows = annualRows.map((annualRow) => {
		const recentRow = recentRows.find((r) => r.organism === annualRow.organism);
		const hospitalRow = hospitalRows.find((r) => r.organism === annualRow.organism);
		return {
			organism: annualRow.organism,
			annualIsolates: annualRow.isolates,
			recentIsolates: recentRow?.isolates ?? 0,
			cells: Object.fromEntries(
				Object.entries(annualRow.cells).map(([code, annualShare]) => {
					const recentShare = recentRow?.cells[code] ?? null;
					return [
						code,
						{
							annual: annualShare,
							recent: recentShare,
							hospital: hospitalRow?.cells[code] ?? null,
							drop: recentShare ? isSignificantDrop(recentShare, annualShare) : false
						}
					];
				})
			)
		};
	});

	// Optional drill-down: monthly trend for one organism × antibiotic.
	const organism = q.get('organism');
	const code = q.get('ab');
	let trend = null;
	if (
		organism &&
		code &&
		data.organisms.includes(organism) &&
		antibiotics.some((a) => a.code === code)
	) {
		trend = {
			organism,
			antibiotic: antibiotics.find((a) => a.code === code)!,
			selected: monthlyTrend(data.isolates, { ...filter, organism }, code, asOf),
			hospital: filter.ward
				? monthlyTrend(data.isolates, { ...filter, organism, ward: undefined }, code, asOf)
				: null
		};
	}

	return {
		filter,
		asOf,
		windows: { recent, annual },
		range: { first: data.firstDate, last: data.lastDate },
		wards: data.wards,
		antibiotics,
		rows,
		trend
	};
};
