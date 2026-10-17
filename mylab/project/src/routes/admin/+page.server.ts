import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/admin.ts';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { importHistory, importLabFiles } from '#lib/server/import/importLab.ts';
import { TABLES } from '#lib/import/labCsv.ts';

/** 20 MB per import: the whole synthetic extract is ~12 MB. */
const MAX_BYTES = 20 * 1024 * 1024;

export const load: PageServerLoad = async (event) => {
	const user = requireAdmin(event);
	const data = await getDataset();
	return {
		email: user.email,
		tables: TABLES,
		history: importHistory(),
		dataset: {
			cultures: data.totalCultures,
			isolates: data.isolates.length,
			firstDate: data.firstDate,
			lastDate: data.lastDate,
			loadedAt: data.loadedAt.toISOString()
		}
	};
};

export const actions: Actions = {
	import: async (event) => {
		const user = requireAdmin(event);
		const form = await event.request.formData();
		const uploads = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
		if (!uploads.length) return fail(400, { error: 'noFiles' });
		if (uploads.reduce((s, f) => s + f.size, 0) > MAX_BYTES)
			return fail(413, { error: 'tooLarge' });
		const files = await Promise.all(
			uploads.map(async (f) => ({ name: f.name, text: await f.text() }))
		);
		const result = await importLabFiles(files, {
			dryRun: form.get('mode') !== 'import',
			by: user.email
		});
		return { result };
	},
	signOut: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		redirect(303, '/');
	}
};
