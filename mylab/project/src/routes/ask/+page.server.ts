import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { getProvider } from '#lib/server/ai/index.ts';
import { recall } from '#lib/server/ai/history.ts';

const EXAMPLES = [
	{ lang: 'EN', text: 'How is Klebsiella resistance evolving in ICU?' },
	{ lang: 'EN', text: 'What should I give a 78-year-old man with febrile UTI in Urology?' },
	{ lang: 'FR', text: 'Y a-t-il des alertes en cours aux urgences ?' },
	{ lang: 'FR', text: 'Comment évolue la résistance d’E. coli à la ceftriaxone dans le sang ?' },
	{
		lang: 'FI',
		text: 'Mitä antibioottia annan 70-vuotiaalle naiselle, jolla on kuumeinen virtsatieinfektio?'
	},
	{ lang: 'FI', text: 'Onko teho-osastolla MRSA-rypäitä?' }
];

export const load: PageServerLoad = async ({ url }) => {
	const data = await getDataset();
	const question = url.searchParams.get('q')?.trim() ?? '';

	let model: { backend: string; model: string; online: boolean; tools: boolean | null } | null =
		null;
	let modelError: string | null = null;
	try {
		const provider = getProvider();
		const online = await provider.ping();
		const tools = online ? await provider.supportsTools().catch(() => null) : null;
		model = { backend: provider.backend, model: provider.model, online, tools };
	} catch (e) {
		modelError = e instanceof Error ? e.message : String(e);
	}

	return {
		question,
		cached: question ? recall(data.version, question) : null,
		examples: EXAMPLES,
		model,
		modelError,
		lastDate: data.lastDate
	};
};
