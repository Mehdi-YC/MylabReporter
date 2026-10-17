import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';
import { isAdminEmail } from '#lib/server/admin.ts';

/** Only same-site paths after sign-in. */
const safeNext = (value: FormDataEntryValue | string | null) => {
	const next = String(value ?? '');
	return next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
};

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user && isAdminEmail(locals.user.email))
		redirect(303, safeNext(url.searchParams.get('next')));
	return { next: safeNext(url.searchParams.get('next')), signedInAs: locals.user?.email ?? null };
};

export const actions: Actions = {
	signIn: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!isAdminEmail(email)) return fail(403, { form: 'signIn', error: 'notAllowed', email });
		try {
			await auth.api.signInEmail({ body: { email, password } });
		} catch (e) {
			if (e instanceof APIError) return fail(400, { form: 'signIn', error: 'failed', email });
			throw e;
		}
		redirect(303, safeNext(form.get('next')));
	},
	signUp: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const name = String(form.get('name') ?? '').trim() || email;
		// Accounts can only be created for the configured administrators.
		if (!isAdminEmail(email)) return fail(403, { form: 'signUp', error: 'notAllowed', email });
		try {
			await auth.api.signUpEmail({ body: { email, password, name } });
		} catch (e) {
			if (e instanceof APIError)
				return fail(400, { form: 'signUp', error: 'failed', email, detail: e.message });
			throw e;
		}
		redirect(303, safeNext(form.get('next')));
	}
};
