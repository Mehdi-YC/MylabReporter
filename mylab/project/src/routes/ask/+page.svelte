<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AskEvent, IntentSource } from '#lib/server/ai/assistant.ts';
	import type { Answer } from '#lib/server/ai/answer.ts';
	import type { Intent } from '#lib/server/ai/intent.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface Run {
		question: string;
		status: string | null;
		intent: Intent | null;
		via: IntentSource | null;
		dropped: string[];
		answer: Answer | null;
		text: string;
		unsupported: string[] | null;
		errors: string[];
		model: string | null;
		ms: number | null;
		running: boolean;
	}

	const emptyRun = (question: string): Run => ({
		question,
		status: null,
		intent: null,
		via: null,
		dropped: [],
		answer: null,
		text: '',
		unsupported: null,
		errors: [],
		model: null,
		ms: null,
		running: true
	});

	function apply(run: Run, event: AskEvent) {
		if (event.type === 'status') run.status = event.message;
		else if (event.type === 'intent') {
			run.intent = event.intent;
			run.via = event.via;
			run.dropped = event.dropped;
		} else if (event.type === 'answer') run.answer = event.answer;
		else if (event.type === 'token') run.text += event.text;
		else if (event.type === 'check') run.unsupported = event.unsupported;
		else if (event.type === 'error') run.errors.push(event.message);
		else if (event.type === 'done') {
			run.model = event.model;
			run.ms = event.ms;
			run.running = false;
			run.status = null;
		}
	}

	function replay(question: string, events: AskEvent[]): Run {
		const r = emptyRun(question);
		for (const e of events) apply(r, e);
		r.running = false;
		return r;
	}

	// svelte-ignore state_referenced_locally
	let question = $state(data.question);
	// svelte-ignore state_referenced_locally
	let run = $state<Run | null>(data.cached ? replay(data.question, data.cached) : null);
	let useModel = $state(true);
	let controller: AbortController | null = null;

	async function submit(text = question) {
		text = text.trim();
		if (!text) return;
		question = text;
		controller?.abort();
		controller = new AbortController();
		run = emptyRun(text);
		const current = run;
		replaceState(resolve(`/ask?q=${encodeURIComponent(text)}`), {});
		try {
			const response = await fetch(resolve('/ask'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ question: text, useModel }),
				signal: controller.signal
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
				for (const line of lines) if (line.trim()) apply(current, JSON.parse(line));
			}
		} catch (e) {
			if ((e as Error).name !== 'AbortError') current.errors.push(`Request failed: ${e}`);
		} finally {
			current.running = false;
		}
	}

	onMount(() => {
		if (data.question && !data.cached) submit(data.question);
		return () => controller?.abort();
	});

	const VIA: Record<IntentSource, string> = {
		tools: 'tool calling',
		json: 'JSON intent',
		keywords: 'keyword parser (no model)'
	};

	const intentChips = (intent: Intent) =>
		(
			[
				['question', intent.type],
				['ward', intent.ward],
				['organism', intent.organism],
				['specimen', intent.specimen],
				['antibiotic', intent.antibiotic],
				['infection', intent.site],
				['sex', intent.sex],
				['age', intent.age],
				['date', intent.asOf]
			] as const
		).filter(([, v]) => v);

	interface DrugFact {
		code: string;
		name: string;
		last12Months: { pct: number | null; n: number; lowN?: boolean };
		previous12Months: { pct: number | null; n: number; lowN?: boolean };
		last4Weeks: { pct: number | null; n: number; lowN?: boolean };
		recentDrop: boolean;
	}
	const drugs = $derived((run?.answer?.facts.percentSusceptible as DrugFact[] | undefined) ?? null);
	const cell = (s: { pct: number | null; n: number; lowN?: boolean }) =>
		s.pct === null ? '–' : `${s.pct} %`;
</script>

<section class="mb-5">
	<h1 class="text-2xl font-semibold tracking-tight">Ask the laboratory data</h1>
	<p class="mt-1 max-w-3xl text-slate-600">
		Ask in English, French or Finnish. The question is turned into a query on the surveillance data;
		every figure is computed by the same code as the antibiogram, alerts and advisor pages, and the
		language model only puts those aggregates into words. No patient-level data is sent to the
		model.
	</p>
</section>

<div class="grid gap-5 lg:grid-cols-[1fr_18rem]">
	<div class="space-y-5">
		<form
			class="rounded-xl border border-slate-200 bg-white p-4"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<label class="block text-sm font-medium text-slate-700" for="q">Question</label>
			<div class="mt-1 flex gap-2">
				<input
					id="q"
					name="q"
					bind:value={question}
					placeholder="How is Klebsiella resistance evolving in ICU?"
					class="w-full rounded-md border-slate-300 text-sm"
					autocomplete="off"
				/>
				<button
					class="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
					disabled={!question.trim()}>{run?.running ? 'Asking…' : 'Ask'}</button
				>
			</div>
			<label class="mt-2 flex items-center gap-2 text-xs text-slate-600">
				<input type="checkbox" bind:checked={useModel} class="rounded border-slate-300" />
				Word the answer with the language model (unticked: computed answer only, instant)
			</label>
		</form>

		{#if run}
			{#each run.errors as message, i (i)}
				<p class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">⚠ {message}</p>
			{/each}

			{#if run.text || (run.running && useModel)}
				<section class="rounded-xl border border-teal-200 bg-white p-4">
					<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
						<h2 class="font-semibold">Answer</h2>
						<span class="text-xs text-slate-500">
							{#if run.model}
								{run.model} · {((run.ms ?? 0) / 1000).toFixed(0)} s
							{:else if run.status}
								<span class="animate-pulse">{run.status}</span>
							{/if}
						</span>
					</div>
					{#if run.text}
						<p class="whitespace-pre-wrap text-slate-800">
							{run.text}{#if run.running}<span class="animate-pulse">▍</span>{/if}
						</p>
					{:else}
						<p class="text-sm text-slate-500">
							Local models run on the CPU here: the first answer can take a minute or two. The
							computed answer below is already final.
						</p>
					{/if}
					{#if run.unsupported}
						{#if run.unsupported.length}
							<p class="mt-2 text-xs text-amber-700">
								⚠ Figures not found in the computed data: {run.unsupported.join(', ')}. Trust the
								computed answer below.
							</p>
						{:else}
							<p class="mt-2 text-xs text-emerald-700">
								✓ Every figure in this answer matches the computed data.
							</p>
						{/if}
					{/if}
				</section>
			{/if}

			{#if run.answer}
				{@const answer = run.answer}
				<section class="rounded-xl border border-slate-200 bg-white p-4">
					<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
						<h2 class="font-semibold">Computed answer</h2>
						<span class="text-xs text-slate-500">{answer.title}</span>
					</div>
					<p class="text-sm text-slate-700">{answer.summary}</p>
					<a
						href="{resolve(answer.link.route)}?{answer.link.query}"
						class="mt-3 inline-block rounded-md bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100"
						>{answer.link.label} →</a
					>
				</section>

				<details
					open={page.url.searchParams.has('evidence')}
					class="rounded-xl border border-slate-200 bg-white p-4 text-sm"
				>
					<summary class="cursor-pointer font-semibold">
						Evidence: what the answer is built on
					</summary>
					{#if run.intent}
						<div class="mt-3 flex flex-wrap items-center gap-1.5">
							<span class="text-xs text-slate-500"
								>Understood via {VIA[run.via ?? 'keywords']}:</span
							>
							{#each intentChips(answer.intent) as [label, value] (label)}
								<span class="rounded bg-slate-100 px-2 py-0.5 text-xs"
									><span class="text-slate-500">{label}</span> {value}</span
								>
							{/each}
						</div>
						{#if run.dropped.length}
							<p class="mt-1 text-xs text-amber-700">
								Ignored (not a known code): {run.dropped.join(', ')}
							</p>
						{/if}
					{/if}
					{#if drugs}
						<table class="mt-3 w-full text-left text-xs">
							<thead class="text-slate-500">
								<tr>
									<th class="py-1 font-medium">% susceptible</th>
									<th class="py-1 text-right font-medium">Previous 12 m</th>
									<th class="py-1 text-right font-medium">Last 12 m</th>
									<th class="py-1 text-right font-medium">Last 4 weeks</th>
								</tr>
							</thead>
							<tbody>
								{#each drugs as d (d.code)}
									<tr class="border-t border-slate-100">
										<td class="py-1">{d.name}</td>
										{#each [d.previous12Months, d.last12Months, d.last4Weeks] as s, i (i)}
											<td
												class={[
													'py-1 text-right tabular-nums',
													s.lowN && 'text-slate-400',
													i === 2 && d.recentDrop && 'font-semibold text-rose-700'
												]}>{cell(s)} <span class="text-slate-400">n={s.n}</span></td
											>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
						<p class="mt-1 text-xs text-slate-500">
							First isolates only; grey = fewer than 30 isolates; red = significant drop.
						</p>
					{/if}
					<p class="mt-3 text-xs text-slate-500">
						Aggregates behind the answer (the language model only receives the computed answer
						above, never patient rows):
					</p>
					<pre
						class="mt-1 max-h-80 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(
							answer.facts,
							null,
							2
						)}</pre>
				</details>
			{:else if run.running}
				<p class="text-sm text-slate-500">
					<span class="animate-pulse">{run.status ?? 'Thinking…'}</span>
				</p>
			{/if}
		{/if}
	</div>

	<aside class="space-y-5">
		<section class="rounded-xl border border-slate-200 bg-white p-4 text-sm">
			<h2 class="mb-2 font-semibold">Model</h2>
			{#if data.model}
				<p class="flex items-center gap-2">
					<span
						class={['size-2.5 rounded-full', data.model.online ? 'bg-emerald-500' : 'bg-rose-500']}
					></span>
					<span class="font-medium">{data.model.model}</span>
					<span class="text-slate-500">via {data.model.backend}</span>
				</p>
				<p class="mt-1 text-xs text-slate-500">
					{#if !data.model.online}
						Not reachable: answers fall back to the computed text.
					{:else if data.model.tools}
						Native tool calling.
					{:else}
						No tool support: JSON intent extraction, then computed figures.
					{/if}
				</p>
			{:else}
				<p class="text-xs text-rose-700">{data.modelError}</p>
			{/if}
			<p class="mt-2 text-xs text-slate-500">Data up to {data.lastDate}.</p>
		</section>
		<section class="rounded-xl border border-slate-200 bg-white p-4 text-sm">
			<h2 class="mb-2 font-semibold">Try</h2>
			<ul class="space-y-2">
				{#each data.examples as example (example.text)}
					<li>
						<button
							type="button"
							class="text-left text-teal-800 hover:underline"
							onclick={() => submit(example.text)}
							><span class="mr-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500"
								>{example.lang}</span
							>{example.text}</button
						>
					</li>
				{/each}
			</ul>
		</section>
	</aside>
</div>
