import type { PageServerLoad } from './$types';
import { loadWardPulse } from '#lib/server/amr/pulse.ts';

export const load: PageServerLoad = ({ url, cookies }) => loadWardPulse(url, cookies);
