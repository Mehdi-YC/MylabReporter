import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The ward antibiogram is now the "by ward" view of the resistance page. Old links (alerts,
 * advisor, assistant answers) keep working: ward, specimen, date and the organism × drug cell
 * are carried over.
 */
export const load: PageServerLoad = ({ url }) => {
	const q = url.searchParams;
	const params = new URLSearchParams();
	for (const key of ['ward', 'specimen', 'asOf']) {
		const value = q.get(key);
		if (value) params.set(key, value);
	}
	const organism = q.get('organism');
	const ab = q.get('ab');
	if (organism && ab) {
		params.set('cellOrg', organism);
		params.set('cellAb', ab);
	}
	redirect(308, `/?${params}${organism && ab ? '#detail' : ''}`);
};
