import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { getProvider } from '#lib/server/ai/index.ts';
import { ask, type AskEvent } from '#lib/server/ai/assistant.ts';
import { remember } from '#lib/server/ai/history.ts';
import type { LlmProvider } from '#lib/server/ai/provider.ts';

/** Streams the assistant's progress as newline-delimited JSON events. */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as {
		question?: unknown;
		useModel?: unknown;
		context?: { ward?: unknown; asOf?: unknown };
	} | null;
	const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 500) : '';
	if (!question) error(400, 'Missing question');

	const data = await getDataset();
	let provider: LlmProvider | null = null;
	let setupError: string | null = null;
	if (body?.useModel !== false) {
		try {
			provider = getProvider();
		} catch (e) {
			setupError = e instanceof Error ? e.message : String(e);
		}
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const events: AskEvent[] = [];
			const send = (event: AskEvent) => {
				events.push(event);
				controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
			};
			try {
				if (setupError) send({ type: 'error', message: setupError });
				const context = {
					ward: typeof body?.context?.ward === 'string' ? body.context.ward : undefined,
					asOf: typeof body?.context?.asOf === 'string' ? body.context.asOf : undefined
				};
				for await (const event of ask(question, data, provider, context)) send(event);
				remember(data.version, question, events);
			} catch (e) {
				send({ type: 'error', message: e instanceof Error ? e.message : String(e) });
			} finally {
				controller.close();
			}
		}
	});
	return new Response(stream, {
		headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' }
	});
};
