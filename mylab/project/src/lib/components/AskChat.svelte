<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { ASK_EVENT } from '#lib/askBus.ts';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AskEvent } from '#lib/server/ai/assistant.ts';
	import type { Answer } from '#lib/server/ai/answer.ts';
	import { formatDate, messages, type Locale } from '#lib/i18n.ts';

	let { locale }: { locale: Locale } = $props();

	const t = $derived(messages[locale].chat);

	interface Turn {
		question: string;
		status: string | null;
		answer: Answer | null;
		text: string;
		unsupported: string[] | null;
		errors: string[];
		model: string | null;
		running: boolean;
	}

	let open = $state(false);
	let question = $state('');
	let turns = $state<Turn[]>([]);
	let scroller = $state<HTMLDivElement | null>(null);
	let input = $state<HTMLTextAreaElement | null>(null);
	const busy = $derived(turns.some((turn) => turn.running));

	// The page's ward and date frame the question unless it says otherwise.
	let useContext = $state(true);
	$effect(() => {
		// A new page brings its own filters back.
		void page.url.href;
		useContext = true;
	});
	const pageData = $derived(
		page.data as {
			input?: { ward?: string };
			asOf?: string;
			wards?: { code: string; nameFi: string; nameEn: string }[];
		}
	);
	const context = $derived({
		ward: pageData.input?.ward ?? page.url.searchParams.get('ward') ?? undefined,
		asOf: pageData.asOf ?? page.url.searchParams.get('asOf') ?? undefined
	});
	const contextLabel = $derived.by(() => {
		const w = pageData.wards?.find((x) => x.code === context.ward);
		const ward = w ? (locale === 'fi' ? w.nameFi : w.nameEn) : context.ward;
		return [ward, context.asOf ? formatDate(locale, context.asOf) : null]
			.filter(Boolean)
			.join(' · ');
	});

	function apply(turn: Turn, event: AskEvent) {
		if (event.type === 'status') turn.status = event.message;
		else if (event.type === 'answer') turn.answer = event.answer;
		else if (event.type === 'token') turn.text += event.text;
		else if (event.type === 'check') turn.unsupported = event.unsupported;
		else if (event.type === 'error') turn.errors.push(event.message);
		else if (event.type === 'done') {
			turn.model = event.model;
			turn.running = false;
			turn.status = null;
		}
	}

	async function scrollDown() {
		await tick();
		scroller?.scrollTo({ top: scroller.scrollHeight });
	}

	async function ask(text = question) {
		text = text.trim();
		if (!text || busy) return;
		question = '';
		turns.push({
			question: text,
			status: null,
			answer: null,
			text: '',
			unsupported: null,
			errors: [],
			model: null,
			running: true
		});
		const turn = turns[turns.length - 1];
		scrollDown();
		try {
			const response = await fetch(resolve('/ask'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ question: text, context: useContext ? context : {} })
			});
			if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
			const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '';
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += value;
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) if (line.trim()) apply(turn, JSON.parse(line));
				scrollDown();
			}
		} catch {
			turn.errors.push(t.failed);
		} finally {
			turn.running = false;
			turn.status = null;
		}
	}

	// Other pages open the chat with a ready-made question (askAei).
	onMount(() => {
		const handler = (event: Event) => {
			const q = (event as CustomEvent<{ question: string }>).detail?.question;
			if (!q) return;
			open = true;
			ask(q);
		};
		window.addEventListener(ASK_EVENT, handler);
		return () => window.removeEventListener(ASK_EVENT, handler);
	});

	async function toggle() {
		open = !open;
		if (open) {
			await tick();
			input?.focus();
			scrollDown();
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') open = false;
	}

	function onInputKeydown(event: KeyboardEvent) {
		// Enter sends, Shift+Enter adds a line.
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			ask();
		}
	}
</script>

{#if open}
	<div
		role="dialog"
		aria-modal="false"
		aria-labelledby="ask-chat-title"
		tabindex="-1"
		onkeydown={onKeydown}
		class="fixed right-4 bottom-20 z-50 flex h-[min(620px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
	>
		<div class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
			<div>
				<h2 id="ask-chat-title" class="font-semibold">{t.title}</h2>
				<p class="text-xs text-slate-500">AEI</p>
			</div>
			<button
				type="button"
				class="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
				aria-label={t.close}
				onclick={() => (open = false)}
			>
				<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
					><path
						d="M3 3 L13 13 M13 3 L3 13"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
					/></svg
				>
			</button>
		</div>

		<div bind:this={scroller} class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 text-sm">
			{#if !turns.length}
				<p class="text-slate-600">{t.intro}</p>
				<ul class="flex flex-col gap-2">
					{#each t.examples as example (example)}
						<li>
							<button
								type="button"
								class="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-teal-800 hover:bg-teal-50"
								onclick={() => ask(example)}>{example}</button
							>
						</li>
					{/each}
				</ul>
			{/if}

			{#each turns as turn, i (i)}
				<div class="ml-8 self-end rounded-lg rounded-br-sm bg-slate-900 px-3 py-2 text-white">
					{turn.question}
				</div>
				<div class="mr-4 flex flex-col gap-2">
					{#each turn.errors as error, j (j)}
						<p class="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
					{/each}
					{#if turn.text}
						<div class="rounded-lg rounded-bl-sm bg-slate-100 px-3 py-2">
							<p class="whitespace-pre-wrap text-slate-900">
								{turn.text.trim()}{#if turn.running}<span class="animate-pulse">▍</span>{/if}
							</p>
							{#if turn.unsupported}
								<p
									class={[
										'mt-1.5 text-[11px]',
										turn.unsupported.length ? 'text-amber-800' : 'text-emerald-700'
									]}
								>
									{turn.unsupported.length
										? `⚠ ${t.unchecked(turn.unsupported.join(', '))}`
										: `✓ ${t.checked}`}
								</p>
							{/if}
							{#if turn.model}<p class="mt-1 text-[11px] text-slate-500">{turn.model}</p>{/if}
						</div>
					{/if}
					{#if turn.answer}
						<div class="rounded-lg border border-slate-200 px-3 py-2">
							<p class="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
								{t.computed}
							</p>
							<p class="text-slate-700">{turn.answer.summary}</p>
							<a
								href="{resolve(turn.answer.link.route)}?{turn.answer.link.query}#detail"
								class="mt-2 flex items-center justify-between gap-2 rounded-md bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
								onclick={() => (open = false)}
								><span class="min-w-0 truncate">{turn.answer.title}</span><span class="shrink-0"
									>{t.openView} →</span
								></a
							>
						</div>
					{/if}
					{#if turn.running}
						<p class="animate-pulse text-xs text-slate-500">
							{turn.answer ? t.writing : t.thinking}
						</p>
					{/if}
				</div>
			{/each}
		</div>

		{#if useContext && contextLabel}
			<div
				class="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
			>
				<span class="truncate">{t.context(contextLabel)}</span>
				<button
					type="button"
					class="shrink-0 rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200"
					onclick={() => (useContext = false)}>{t.ignoreContext} ×</button
				>
			</div>
		{/if}
		<form
			class="flex items-end gap-2 border-t border-slate-200 p-3"
			onsubmit={(e) => {
				e.preventDefault();
				ask();
			}}
		>
			<label class="sr-only" for="ask-chat-input">{t.placeholder}</label>
			<textarea
				id="ask-chat-input"
				bind:this={input}
				bind:value={question}
				onkeydown={onInputKeydown}
				rows="2"
				placeholder={t.placeholder}
				class="min-h-11 flex-1 resize-none rounded-md border-slate-300 text-sm"></textarea>
			<button
				class="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
				disabled={!question.trim() || busy}>{t.send}</button
			>
		</form>
	</div>
{/if}

<button
	type="button"
	aria-expanded={open}
	onclick={toggle}
	class="fixed right-4 bottom-4 z-50 flex min-h-12 items-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-semibold text-white shadow-lg hover:bg-teal-800"
>
	<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"
		><path
			d="M4 4 H16 A2 2 0 0 1 18 6 V12 A2 2 0 0 1 16 14 H9 L5 17 V14 H4 A2 2 0 0 1 2 12 V6 A2 2 0 0 1 4 4 Z"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linejoin="round"
		/></svg
	>
	{open ? t.close : t.open}
	{#if busy && !open}<span class="size-2 animate-pulse rounded-full bg-white"></span>{/if}
</button>
