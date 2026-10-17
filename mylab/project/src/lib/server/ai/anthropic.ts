import Anthropic from '@anthropic-ai/sdk';
import {
	parseJsonObject,
	type ChatMessage,
	type LlmProvider,
	type ToolCall,
	type ToolSpec
} from './provider';

const MAX_TOKENS = 1024;

/** Claude through the Anthropic SDK. The system prompt is a separate field in the Messages API. */
export class AnthropicProvider implements LlmProvider {
	readonly backend = 'anthropic';
	private readonly client: Anthropic;

	constructor(
		apiKey: string,
		readonly model: string
	) {
		this.client = new Anthropic({ apiKey });
	}

	private split(messages: ChatMessage[]) {
		return {
			system: messages
				.filter((m) => m.role === 'system')
				.map((m) => m.content)
				.join('\n\n'),
			messages: messages
				.filter((m) => m.role !== 'system')
				.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
		};
	}

	async supportsTools(): Promise<boolean> {
		return true;
	}

	async ping(): Promise<boolean> {
		return true;
	}

	async callTool(
		messages: ChatMessage[],
		tools: ToolSpec[],
		signal?: AbortSignal
	): Promise<ToolCall | null> {
		const response = await this.client.messages.create(
			{
				model: this.model,
				max_tokens: MAX_TOKENS,
				...this.split(messages),
				tools: tools.map((t) => ({
					name: t.name,
					description: t.description,
					input_schema: t.parameters as Anthropic.Tool.InputSchema
				})),
				tool_choice: { type: 'any' }
			},
			{ signal }
		);
		const block = response.content.find((b) => b.type === 'tool_use');
		return block ? { name: block.name, arguments: block.input as Record<string, unknown> } : null;
	}

	async json(messages: ChatMessage[], signal?: AbortSignal): Promise<unknown> {
		const response = await this.client.messages.create(
			{ model: this.model, max_tokens: MAX_TOKENS, ...this.split(messages) },
			{ signal }
		);
		const block = response.content.find((b) => b.type === 'text');
		return parseJsonObject(block?.type === 'text' ? block.text : '');
	}

	async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
		const stream = this.client.messages.stream(
			{ model: this.model, max_tokens: MAX_TOKENS, ...this.split(messages) },
			{ signal }
		);
		for await (const event of stream) {
			if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
				yield event.delta.text;
		}
	}
}
