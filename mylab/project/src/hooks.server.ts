import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { sequence } from '@sveltejs/kit/hooks';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '#lib/i18n.ts';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

/**
 * UI language: `?lang=fi|en` (shareable links), else the FI | EN toggle's cookie, else Finnish.
 * Also sets `<html lang>`.
 */
const handleLocale: Handle = async ({ event, resolve }) => {
	const param = event.url.searchParams.get('lang');
	const cookie = event.cookies.get(LOCALE_COOKIE);
	const locale = isLocale(param) ? param : isLocale(cookie) ? cookie : DEFAULT_LOCALE;
	event.locals.locale = locale;
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', locale)
	});
};

export const handle: Handle = sequence(handleLocale, handleBetterAuth);
