import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The explorer is now the "by organism" view of the resistance page. */
export const load: PageServerLoad = ({ url }) => {
	const q = url.searchParams;
	const params = new URLSearchParams({ view: 'organism' });
	for (const key of ['organism', 'specimen', 'window', 'asOf']) {
		const value = q.get(key);
		if (value) params.set(key, value);
	}
	const ward = q.get('cellWard');
	const ab = q.get('cellAb');
	if (ward) params.set('ward', ward);
	if (ward && ab && q.get('organism')) {
		params.set('cellOrg', q.get('organism')!);
		params.set('cellAb', ab);
	}
	redirect(308, `/?${params}${ward && ab ? '#detail' : ''}`);
};
