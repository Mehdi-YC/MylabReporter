import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isLocale, LOCALE_COOKIE } from '#lib/i18n.ts';

/** FI | EN toggle: stores the choice for every screen. Works as a plain form without JavaScript. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const form = await request.formData();
	const locale = form.get('locale');
	if (isLocale(locale)) {
		cookies.set(LOCALE_COOKIE, locale, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: false
		});
	}
	const back = String(form.get('redirectTo') ?? '/');
	// Only same-site paths: never an open redirect.
	redirect(303, back.startsWith('/') && !back.startsWith('//') ? back : '/');
};
