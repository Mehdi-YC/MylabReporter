import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { europeShapes, MAP_HEIGHT, MAP_WIDTH } from '#lib/server/amr/europe.ts';
import { earsNet } from '#lib/server/amr/earsNet.ts';
import { EARS_INDICATORS, type EarsIndicator } from '#lib/amr/earsNet.ts';
import { selectIsolates, type IsolateFilter } from '#lib/amr/antibiogram.ts';
import { surveillanceWindows } from '#lib/amr/dates.ts';
import { proportion } from '#lib/amr/stats.ts';
import { REGION_INDICATORS, regionalIndicator, type RegionIndicator } from '#lib/amr/regions.ts';
import type { Specimen } from '#lib/amr/types.ts';

const SPECIMENS: Specimen[] = ['urine', 'blood', 'wound'];

export const load: PageServerLoad = async ({ url }) => {
	const data = await getDataset();
	const q = url.searchParams;
	const pick = <T extends string>(key: string, allowed: readonly T[]) => {
		const v = q.get(key);
		return allowed.includes(v as T) ? (v as T) : undefined;
	};

	const indicator =
		pick('indicator', Object.keys(REGION_INDICATORS) as RegionIndicator[]) ?? 'resistance';
	const filter: IsolateFilter = {
		ward: pick(
			'ward',
			data.wards.map((w) => w.code)
		),
		specimen: pick('specimen', SPECIMENS),
		organism: pick('organism', data.organisms) ?? 'Escherichia coli'
	};
	const antibiotic =
		pick(
			'ab',
			data.antibiotics.map((a) => a.code)
		) ?? 'CRO';
	const period = pick('period', ['4w', '12m'] as const) ?? '12m';
	const requestedAsOf = q.get('asOf');
	const asOf =
		requestedAsOf && requestedAsOf >= data.firstDate && requestedAsOf <= data.lastDate
			? requestedAsOf
			: data.lastDate;
	const windows = surveillanceWindows(asOf);
	const window = period === '4w' ? windows.recent : windows.annual;

	const areas = regionalIndicator(data.isolates, filter, window, indicator, antibiotic);
	const all = regionalIndicator(
		data.isolates.map((i) => ({ ...i, homeArea: 'All' })),
		filter,
		window,
		indicator,
		antibiotic
	).find((a) => a.area === 'All');

	// Europe: national EARS-Net figures next to the same indicator in this dataset (blood, all
	// wards, last 12 months, first isolates).
	const euIndicator =
		pick('eu', Object.keys(EARS_INDICATORS) as EarsIndicator[]) ?? 'ecoli_3gc_resistant';
	const blood = selectIsolates(data.isolates, { specimen: 'blood' }, windows.annual);
	const datasetValue =
		euIndicator === 'saureus_mrsa'
			? (() => {
					const sa = blood.filter((i) => i.organism === 'Staphylococcus aureus');
					return proportion(sa.filter((i) => i.mrsa).length, sa.length);
				})()
			: (() => {
					const ec = blood.filter(
						(i) => i.organism === 'Escherichia coli' && i.results.CRO !== undefined
					);
					return proportion(ec.filter((i) => i.results.CRO === 'R').length, ec.length);
				})();

	return {
		filter,
		indicator,
		indicators: Object.entries(REGION_INDICATORS).map(([key, v]) => ({ key, label: v.label })),
		antibiotic,
		period,
		asOf,
		window,
		range: { first: data.firstDate, last: data.lastDate },
		wards: data.wards,
		organisms: data.organisms,
		antibiotics: data.antibiotics.filter((a) => a.code !== 'FOX'),
		areas,
		all,
		europe: {
			width: MAP_WIDTH,
			height: MAP_HEIGHT,
			shapes: europeShapes(),
			indicator: euIndicator,
			indicators: Object.entries(EARS_INDICATORS).map(([key, v]) => ({ key, ...v })),
			values: earsNet().filter((r) => r.indicator === euIndicator),
			dataset: datasetValue,
			datasetWindow: windows.annual
		}
	};
};
