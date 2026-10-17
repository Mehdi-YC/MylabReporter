import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { ADMIN_EMAILS } from '$app/env/private';

/** Only the addresses listed in ADMIN_EMAILS may sign in to /admin or create an admin account. */
export function isAdminEmail(email: string | null | undefined): boolean {
	return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Guards an admin page or action: sign-in page when signed out, 403 for other accounts. */
export function requireAdmin(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) redirect(303, `/admin/login?next=${encodeURIComponent(event.url.pathname)}`);
	if (!isAdminEmail(user.email)) error(403, 'This account is not an administrator');
	return user;
}
