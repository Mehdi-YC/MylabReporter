<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AlertCard from '#lib/components/AlertCard.svelte';
	import { formatDate, messages } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const weekIndex = $derived.by(() => {
		// Last timeline week on or before the reference date.
		let idx = 0;
		data.timeline.forEach((w, i) => {
			if (w.asOf <= data.asOf) idx = i;
		});
		return idx;
	});

	let playing = $state(false);

	function show(asOf: string) {
		return goto(resolve(`/alerts?asOf=${asOf}`), { reset: false, replace: playing });
	}

	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			const next = data.timeline[weekIndex + 1];
			if (next) show(next.asOf);
			else playing = false;
		}, 650);
		return () => clearInterval(timer);
	});

	function startReplay() {
		// Restart from the beginning when the replay already reached the end.
		if (weekIndex >= data.timeline.length - 1) show(data.timeline[0].asOf);
		playing = true;
	}

	const t = $derived(messages[data.locale]);
	const fi = $derived(data.locale === 'fi');
	const wardName = (code: string) => {
		const w = data.wards.find((x) => x.code === code);
		return w ? (fi ? w.nameFi : w.nameEn) : code;
	};
	const abName = (code?: string) => {
		const a = data.antibiotics.find((x) => x.code === code);
		return a ? (fi ? a.nameFi : a.name) : undefined;
	};
	const linkedCount = $derived(Object.keys(data.linked).length);

	const yearMarks = $derived(
		data.timeline
			.map((w, i) => ({ i, label: w.asOf.slice(0, 7) }))
			.filter(({ i, label }) => i === 0 || label.slice(5) !== data.timeline[i - 1].asOf.slice(5, 7))
			.filter(({ label }) => ['01', '04', '07', '10'].includes(label.slice(5)))
	);

	const LEVEL_CELL = {
		critical: 'bg-rose-600',
		warning: 'bg-amber-400',
		sentinel: 'bg-slate-900',
		none: 'bg-slate-100 hover:bg-slate-300'
	};
	const LEVEL_TILE = {
		critical: { box: 'border-rose-300 bg-rose-50', text: 'text-rose-700' },
		warning: { box: 'border-amber-300 bg-amber-50', text: 'text-amber-800' },
		sentinel: { box: 'border-slate-400 bg-white', text: 'text-slate-900' },
		none: { box: 'border-emerald-200 bg-emerald-50/50', text: 'text-emerald-700' }
	};

	const critical = $derived(data.alerts.filter((a) => a.severity === 'critical').length);
	const warning = $derived(data.alerts.length - critical);
</script>

<section class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-[28px] font-semibold tracking-tight">{t.alerts.title}</h1>
		<p class="mt-1 max-w-3xl text-sm text-slate-600">{t.alerts.intro}</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
			disabled={weekIndex === 0}
			onclick={() => show(data.timeline[weekIndex - 1].asOf)}>{t.alerts.prevWeek}</button
		>
		{#if playing}
			<button
				type="button"
				class="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white"
				onclick={() => (playing = false)}>{t.alerts.pause}</button
			>
		{:else}
			<button
				type="button"
				class="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
				onclick={startReplay}>{t.alerts.replay}</button
			>
		{/if}
		<button
			type="button"
			class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
			disabled={weekIndex >= data.timeline.length - 1}
			onclick={() => show(data.timeline[weekIndex + 1].asOf)}>{t.alerts.nextWeek}</button
		>
		<button
			type="button"
			class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
			onclick={() => show(data.lastDate)}>{t.alerts.today}</button
		>
	</div>
</section>

<section class="mb-5 rounded-xl border border-slate-200 bg-white p-4">
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="font-semibold">{t.alerts.history}</h2>
		<span class="text-sm text-slate-500">{t.alerts.historyHint}</span>
	</div>
	<div class="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
		{#each data.wards as ward (ward.code)}
			<div class="truncate py-0.5 font-mono font-medium text-slate-600" title={wardName(ward.code)}>
				{ward.code}
			</div>
			<div
				class="grid gap-px"
				style:grid-template-columns="repeat({data.timeline.length}, minmax(0, 1fr))"
			>
				{#each data.timeline as week, i (week.asOf)}
					{@const status = week.wards[ward.code]}
					<a
						href={resolve(`/alerts?asOf=${week.asOf}`)}
						data-sveltekit-reset="false"
						title="{ward.code} · {t.alerts.weekEnding} {formatDate(data.locale, week.asOf)}{status
							? ` · ${status}`
							: ''}"
						class={[
							'h-4 rounded-[2px]',
							LEVEL_CELL[status ?? 'none'],
							i === weekIndex && 'outline-2 outline-offset-1 outline-slate-900'
						]}
						aria-label="{ward.code}, {t.alerts.weekEnding} {formatDate(data.locale, week.asOf)}"
					></a>
				{/each}
			</div>
		{/each}
		<div></div>
		<div class="relative h-5">
			{#each yearMarks as mark (mark.i)}
				<span
					class="absolute top-1 -translate-x-1/2 text-[11px] whitespace-nowrap text-slate-400"
					style:left="{(mark.i / data.timeline.length) * 100}%">{mark.label}</span
				>
			{/each}
		</div>
	</div>
	<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
		<span class="flex items-center gap-1.5"
			><span class="size-3 rounded-sm bg-rose-600"></span> {t.alerts.legendCritical}</span
		>
		<span class="flex items-center gap-1.5"
			><span class="size-3 rounded-sm bg-amber-400"></span> {t.alerts.legendWarning}</span
		>
		<span class="flex items-center gap-1.5"
			><span class="size-3 rounded-sm bg-slate-900"></span> {t.alerts.legendSentinel}</span
		>
		<span>{t.alerts.legendNote}</span>
	</div>
</section>

<section class="mb-5">
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="text-lg font-semibold">
			{t.alerts.situation(formatDate(data.locale, data.asOf))}
			{#if data.asOf === data.lastDate}<span
					class="ml-2 rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800"
					>{t.alerts.latest}</span
				>{/if}
		</h2>
		<span class="text-sm text-slate-500">
			{t.alerts.counts(critical, warning)}
		</span>
	</div>
	<div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
		{#each data.wards as ward (ward.code)}
			{@const tile = LEVEL_TILE[data.wardStatus[ward.code] ?? 'none']}
			<div class={['rounded-lg border px-3 py-2 transition-colors', tile.box]}>
				<div class="font-mono text-sm font-semibold">{ward.code}</div>
				<div class="truncate text-[11px] text-slate-500">{wardName(ward.code)}</div>
				<div class={['mt-1 text-xs font-medium', tile.text]}>
					{t.alerts.levels[data.wardStatus[ward.code] ?? 'none']}
				</div>
			</div>
		{/each}
	</div>
</section>

{#if data.alerts.length}
	<p class="mb-3 border-y border-slate-200 py-3 text-sm text-slate-600">
		{t.alerts.triage(data.alerts.length, linkedCount)}
	</p>
{/if}

<section class="grid gap-3">
	{#each data.alerts as alert, i (alert.id)}
		<AlertCard
			{alert}
			rank={i + 1}
			locale={data.locale}
			linked={!!data.linked[alert.id]}
			wardName={wardName(alert.ward)}
			antibioticName={abName(alert.antibiotic)}
			asOf={data.asOf}
		/>
	{:else}
		<p class="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
			{t.alerts.none(formatDate(data.locale, data.asOf))}
		</p>
	{/each}
</section>
