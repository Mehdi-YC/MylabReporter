import {
	AI_PROVIDER,
	ANTHROPIC_API_KEY,
	ANTHROPIC_MODEL,
	OLLAMA_MODEL,
	OLLAMA_URL,
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL
} from '$app/env/private';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import { OpenAiCompatibleProvider } from './openai';
import type { LlmProvider } from './provider';

let provider: LlmProvider | null = null;

/** The configured model backend (AI_PROVIDER), Ollama by default. */
export function getProvider(): LlmProvider {
	if (provider) return provider;
	if (AI_PROVIDER === 'anthropic') {
		if (!ANTHROPIC_API_KEY) throw new Error('AI_PROVIDER=anthropic needs ANTHROPIC_API_KEY');
		provider = new AnthropicProvider(ANTHROPIC_API_KEY, ANTHROPIC_MODEL);
	} else if (AI_PROVIDER === 'openai') {
		provider = new OpenAiCompatibleProvider(OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL);
	} else {
		provider = new OllamaProvider(OLLAMA_URL, OLLAMA_MODEL);
	}
	return provider;
}
