import type { Cookies } from '@sveltejs/kit';

/** The ward last chosen anywhere: pages without a ward in their URL open on it. */
export const WARD_COOKIE = 'aei-ward';

export function rememberedWard(cookies: Cookies, valid: string[]): string | undefined {
	const ward = cookies.get(WARD_COOKIE);
	return ward && valid.includes(ward) ? ward : undefined;
}

export function rememberWard(cookies: Cookies, ward: string): void {
	cookies.set(WARD_COOKIE, ward, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false
	});
}
