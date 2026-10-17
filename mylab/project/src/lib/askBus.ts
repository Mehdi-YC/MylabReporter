/** Opens the assistant chat with a question, from any page (the chat lives in the layout). */
export const ASK_EVENT = 'aei-ask';

export function askAei(question: string): void {
	window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { question } }));
}
