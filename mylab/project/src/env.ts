import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;
const withDefault = (fallback: string) => (value: string | undefined) => value || fallback;

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	AI_PROVIDER: {
		description:
			'Language model backend for the /ask assistant: `ollama` (default), `openai` (any OpenAI-compatible endpoint) or `anthropic`.',
		schema: (value) => {
			const provider = value || 'ollama';
			if (!['ollama', 'openai', 'anthropic'].includes(provider))
				throw new Error('AI_PROVIDER must be ollama, openai or anthropic');
			return provider as 'ollama' | 'openai' | 'anthropic';
		}
	},
	OLLAMA_URL: {
		description:
			'Base URL of the local Ollama server (127.0.0.1 rather than localhost: Ollama does not listen on IPv6 ::1).',
		schema: withDefault('http://127.0.0.1:11434')
	},
	OLLAMA_MODEL: {
		description: 'Ollama model used by the assistant. Models with tool support are used natively.',
		schema: withDefault('mistral:latest')
	},
	OPENAI_BASE_URL: {
		description: 'OpenAI-compatible endpoint, e.g. `https://api.openai.com/v1` or a vLLM server.',
		schema: withDefault('https://api.openai.com/v1')
	},
	OPENAI_API_KEY: { description: 'API key for the OpenAI-compatible endpoint.', schema: optional },
	OPENAI_MODEL: {
		description: 'Model name on the OpenAI-compatible endpoint.',
		schema: withDefault('gpt-4o-mini')
	},
	ANTHROPIC_API_KEY: {
		description: 'Anthropic API key. Setting it with AI_PROVIDER=anthropic uses Claude.',
		schema: optional
	},
	ADMIN_EMAILS: {
		description:
			'Comma-separated e-mail addresses allowed to sign in to /admin and import laboratory CSV files.',
		schema: (value) =>
			(value ?? '')
				.split(',')
				.map((e) => e.trim().toLowerCase())
				.filter(Boolean)
	},
	ANTHROPIC_MODEL: { description: 'Claude model id.', schema: withDefault('claude-haiku-5-5') }
});
