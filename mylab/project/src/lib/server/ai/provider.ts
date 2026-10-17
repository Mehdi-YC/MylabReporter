/** Provider-neutral view of a chat model: the assistant only depends on this interface. */

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/** JSON Schema of a function the model may call. */
export interface ToolSpec {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

export interface LlmProvider {
	/** Backend name, e.g. `ollama`. */
	readonly backend: string;
	/** Model identifier shown next to every answer. */
	readonly model: string;
	/** Whether the model can be driven with native tool (function) calling. */
	supportsTools(): Promise<boolean>;
	/** Quick reachability check for the status badge. */
	ping(): Promise<boolean>;
	/** Single non-streamed turn with tools; returns the first tool call, if any. */
	callTool(
		messages: ChatMessage[],
		tools: ToolSpec[],
		signal?: AbortSignal
	): Promise<ToolCall | null>;
	/** Single non-streamed turn constrained to a JSON object. */
	json(messages: ChatMessage[], signal?: AbortSignal): Promise<unknown>;
	/** Streams the text of one assistant turn. */
	stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string>;
}

/** Parses a JSON object out of a model reply, tolerating code fences and surrounding prose. */
export function parseJsonObject(text: string): unknown {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end <= start) throw new Error('No JSON object in model reply');
	return JSON.parse(text.slice(start, end + 1));
}

/**
 * Small local models sometimes describe the call in prose instead of emitting a structured
 * tool call, e.g. `resistance(organism: "Klebsiella pneumoniae", ward: "ICU")`. Recovers the
 * first such call (or a `{"name": …, "arguments": …}` object) for one of the known tools.
 */
export function parseTextToolCall(text: string, toolNames: string[]): ToolCall | null {
	const names = toolNames.map((n) => n.replace(/[^\w-]/g, '')).join('|');
	const call = text.match(new RegExp(`\\b(${names})\\s*\\(([^)]*)\\)`));
	if (call) {
		const args: Record<string, unknown> = {};
		for (const m of call[2].matchAll(/(\w+)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|([\w.-]+))/g))
			args[m[1]] = m[2] ?? m[3] ?? m[4];
		return { name: call[1], arguments: args };
	}
	try {
		const json = parseJsonObject(text) as { name?: unknown; arguments?: unknown };
		if (typeof json.name === 'string' && toolNames.includes(json.name))
			return {
				name: json.name,
				arguments: (json.arguments && typeof json.arguments === 'object'
					? json.arguments
					: {}) as Record<string, unknown>
			};
	} catch {
		// No JSON either.
	}
	return null;
}

/** Splits a fetch body into lines as they arrive (NDJSON, server-sent events). */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let nl: number;
		while ((nl = buffer.indexOf('\n')) !== -1) {
			const line = buffer.slice(0, nl).trim();
			buffer = buffer.slice(nl + 1);
			if (line) yield line;
		}
	}
	if (buffer.trim()) yield buffer.trim();
}

export async function ensureOk(response: Response): Promise<Response> {
	if (!response.ok) {
		const detail = (await response.text().catch(() => '')).slice(0, 200);
		throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
	}
	return response;
}
