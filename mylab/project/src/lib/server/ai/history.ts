import type { AskEvent } from './assistant';

const MAX_ENTRIES = 30;
const history = new Map<string, AskEvent[]>();

const key = (version: string, question: string) =>
	`${version}|${question.trim().replace(/\s+/g, ' ').toLowerCase()}`;

/** Completed answers, so a shared `/ask?q=…` link renders at once instead of re-asking the model. */
export function remember(version: string, question: string, events: AskEvent[]): void {
	const k = key(version, question);
	history.delete(k);
	history.set(k, events);
	while (history.size > MAX_ENTRIES) history.delete(history.keys().next().value!);
}

export function recall(version: string, question: string): AskEvent[] | null {
	return history.get(key(version, question)) ?? null;
}
