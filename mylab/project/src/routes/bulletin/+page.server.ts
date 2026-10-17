import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { hospitalBulletin, wardBulletin } from '#lib/server/amr/bulletin.ts';

/** One weekly bulletin (query: kind = ward | hospital, ward, asOf), printable. */
export const load: PageServerLoad = async ({ url, cookies }) => {
	const data = await getDataset();
	const requested = url.searchParams.get('asOf');
	const asOf =
		requested && requested >= data.firstDate && requested <= data.lastDate
			? requested
			: data.lastDate;
	const bulletin =
		url.searchParams.get('kind') === 'hospital'
			? hospitalBulletin(data, asOf)
			: await wardBulletin(data, url, cookies, asOf);
	return {
		asOf,
		bulletin,
		wards: data.wards,
		antibiotics: data.antibiotics.map((a) => ({ code: a.code, name: a.name, nameFi: a.nameFi }))
	};
};
