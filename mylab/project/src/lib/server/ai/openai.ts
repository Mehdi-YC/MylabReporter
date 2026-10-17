import {
	ensureOk,
	parseJsonObject,
	readLines,
	type ChatMessage,
	type LlmProvider,
	type ToolCall,
	type ToolSpec
} from './provider';

/** Any OpenAI-compatible `/chat/completions` endpoint (OpenAI, vLLM, LM Studio, llama.cpp…). */
export class OpenAiCompatibleProvider implements LlmProvider {
	readonly backend = 'openai';

	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string | undefined,
		readonly model: string
	) {}

	private headers(): Record<string, string> {
		return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {};
	}

	private post(body: Record<string, unknown>, signal?: AbortSignal) {
		return fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...this.headers() },
			body: JSON.stringify({ model: this.model, ...body }),
			signal
		}).then(ensureOk);
	}

	async supportsTools(): Promise<boolean> {
		return true;
	}

	async ping(): Promise<boolean> {
		try {
			const r = await fetch(`${this.baseUrl.replace(/\/$/, '')}/models`, {
				headers: this.headers(),
				signal: AbortSignal.timeout(3000)
			});
			return r.ok;
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
			{
				messages,
				temperature: 0,
				tools: tools.map((t) => ({ type: 'function', function: t })),
				tool_choice: 'required'
			},
			signal
		);
		const data = (await r.json()) as {
			choices: { message: { tool_calls?: { function: { name: string; arguments: string } }[] } }[];
		};
		const call = data.choices[0]?.message.tool_calls?.[0]?.function;
		return call ? { name: call.name, arguments: JSON.parse(call.arguments || '{}') } : null;
	}

	async json(messages: ChatMessage[], signal?: AbortSignal): Promise<unknown> {
		const r = await this.post(
			{ messages, temperature: 0, response_format: { type: 'json_object' } },
			signal
		);
		const data = (await r.json()) as { choices: { message: { content: string } }[] };
		return parseJsonObject(data.choices[0]?.message.content ?? '');
	}

	async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
		const r = await this.post({ messages, temperature: 0, stream: true }, signal);
		for await (const line of readLines(r.body!)) {
			if (!line.startsWith('data:')) continue;
			const payload = line.slice(5).trim();
			if (payload === '[DONE]') return;
			const chunk = JSON.parse(payload) as { choices: { delta?: { content?: string } }[] };
			const text = chunk.choices[0]?.delta?.content;
			if (text) yield text;
		}
	}
}
