import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import type { IsolateFilter } from '#lib/amr/antibiogram.ts';
import { surveillanceWindows } from '#lib/amr/dates.ts';
import { explorerMatrix } from '#lib/amr/explorer.ts';
import type { Specimen } from '#lib/amr/types.ts';

const SPECIMENS: Specimen[] = ['urine', 'blood', 'wound'];

export const load: PageServerLoad = async ({ url }) => {
	const data = await getDataset();
	const q = url.searchParams;
	const pick = <T extends string>(key: string, allowed: readonly T[]) => {
		const v = q.get(key);
		return allowed.includes(v as T) ? (v as T) : undefined;
	};
	const organism = pick('organism', data.organisms) ?? 'Escherichia coli';
	const filter: IsolateFilter = {
		organism,
		specimen: pick('specimen', SPECIMENS),
		onset: pick('onset', ['hospital', 'community'] as const)
	};
	const window = q.get('window') === '12m' ? '12m' : '4w';
	const requestedAsOf = q.get('asOf');
	const asOf =
		requestedAsOf && requestedAsOf >= data.firstDate && requestedAsOf <= data.lastDate
			? requestedAsOf
			: data.lastDate;
	const windows = surveillanceWindows(asOf);

	// Drugs this organism is tested for in the selection, screening agents excluded.
	const tested = new Set<string>();
	for (const i of data.isolates)
		if (
			i.organism === organism &&
			(!filter.specimen || i.specimen === filter.specimen) &&
			i.date >= windows.annual.from &&
			i.date <= windows.annual.to
		)
			for (const code of Object.keys(i.results)) tested.add(code);
	const antibiotics = data.antibiotics.filter((a) => tested.has(a.code) && a.code !== 'FOX');

	const rows = explorerMatrix(
		data.isolates,
		data.wards.map((w) => w.code),
		antibiotics.map((a) => a.code),
		filter,
		windows
	);

	const selWard = pick(
		'cellWard',
		data.wards.map((w) => w.code)
	);
	const selCode = pick(
		'cellAb',
		antibiotics.map((a) => a.code)
	);

	return {
		asOf,
		range: { first: data.firstDate, last: data.lastDate },
		windows,
		input: { organism, specimen: filter.specimen ?? '', onset: filter.onset ?? '', window },
		organisms: data.organisms,
		wards: data.wards,
		antibiotics: antibiotics.map((a) => ({ code: a.code, name: a.name, nameFi: a.nameFi })),
		rows,
		selected: selWard && selCode ? { ward: selWard, code: selCode } : null
	};
};
