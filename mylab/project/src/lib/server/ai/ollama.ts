import {
	ensureOk,
	parseTextToolCall,
	readLines,
	type ChatMessage,
	type LlmProvider,
	type ToolCall,
	type ToolSpec
} from './provider';

/** Local models through Ollama's `/api/chat` (https://github.com/ollama/ollama/blob/main/docs/api.md). */
export class OllamaProvider implements LlmProvider {
	readonly backend = 'ollama';
	private capabilities: Promise<string[]> | null = null;

	constructor(
		private readonly url: string,
		readonly model: string
	) {}

	private post(path: string, body: unknown, signal?: AbortSignal) {
		return fetch(`${this.url.replace(/\/$/, '')}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal
		}).then(ensureOk);
	}

	async supportsTools(): Promise<boolean> {
		// `/api/show` lists what the model can do, e.g. ["completion", "tools"].
		this.capabilities ??= this.post('/api/show', { model: this.model })
			.then((r) => r.json())
			.then((info: { capabilities?: string[] }) => info.capabilities ?? [])
			.catch((error) => {
				this.capabilities = null;
				throw error;
			});
		return (await this.capabilities).includes('tools');
	}

	async ping(): Promise<boolean> {
		try {
			const r = await fetch(`${this.url.replace(/\/$/, '')}/api/tags`, {
				signal: AbortSignal.timeout(1500)
			});
			if (!r.ok) return false;
			const { models } = (await r.json()) as { models: { name: string }[] };
			return models.some((m) => m.name === this.model || m.name === `${this.model}:latest`);
		} catch {
			return false;
		}
	}

	async callTool(
		messages: ChatMessage[],
		tools: ToolSpec[],
		signal?: AbortSignal
	): Promise<ToolCall | null> {
		const r = await this.post(
			'/api/chat',
			{
				model: this.model,
				messages,
				stream: false,
				keep_alive: '30m',
				options: { temperature: 0 },
				tools: tools.map((t) => ({ type: 'function', function: t }))
			},
			signal
		);
		const { message } = (await r.json()) as {
			message: {
				content?: string;
				tool_calls?: { function: { name: string; arguments: unknown } }[];
			};
		};
		const call = message.tool_calls?.[0]?.function;
		if (!call)
			return parseTextToolCall(
				message.content ?? '',
				tools.map((t) => t.name)
			);
		const args =
			typeof call.arguments === 'string' ? JSON.parse(call.arguments) : (call.arguments ?? {});
		return { name: call.name, arguments: args as Record<string, unknown> };
	}

	async json(messages: ChatMessage[], signal?: AbortSignal): Promise<unknown> {
		const r = await this.post(
			'/api/chat',
			{
				model: this.model,
				messages,
				stream: false,
				format: 'json',
				keep_alive: '30m',
				options: { temperature: 0 }
			},
			signal
		);
		const { message } = (await r.json()) as { message: { content: string } };
		return JSON.parse(message.content);
	}

	async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
		const r = await this.post(
			'/api/chat',
			{
				model: this.model,
				messages,
				stream: true,
				keep_alive: '30m',
				options: { temperature: 0 }
			},
			signal
		);
		for await (const line of readLines(r.body!)) {
			const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string };
			if (chunk.error) throw new Error(chunk.error);
			if (chunk.message?.content) yield chunk.message.content;
		}
	}
}
