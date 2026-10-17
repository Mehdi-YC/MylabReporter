<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { alertTitle } from '#lib/alertText.ts';
	import { formatDateTime, formatPercent, messages } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const t = $derived(messages[data.locale]);
	const fi = $derived(data.locale === 'fi');
	const pct = (x: number | null) => formatPercent(data.locale, x);
	const wardName = (code: string) => {
		const w = data.wards.find((x) => x.code === code);
		return w ? (fi ? w.nameFi : w.nameEn) : code;
	};
	const abName = (code: string) => {
		const a = data.antibiotics.find((x) => x.code === code);
		return a ? (fi ? a.nameFi : a.name) : code;
	};
	const top = $derived(data.table.rows[0] ?? null);
	const bars = $derived(
		top
			? top.cells
					.filter((c) => c.annual.n > 0)
					.sort((a, b) => Number(b.rise) - Number(a.rise) || (b.recent.r ?? 0) - (a.recent.r ?? 0))
					.slice(0, 8)
			: []
	);
	const submit = (e: Event) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit();

	/** Current page without a `?lang=` override, so the toggle's choice wins. */
	const backTo = $derived.by(() => {
		const search = new URLSearchParams(
			[...page.url.searchParams].filter(([key]) => key !== 'lang')
		).toString();
		return page.url.pathname + (search ? `?${search}` : '');
	});

	async function switchLocale(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		await fetch(form.action, { method: 'POST', body: new FormData(form, event.submitter) });
		if (page.url.searchParams.has('lang')) location.replace(backTo);
		else await invalidateAll();
	}

	// A wall screen stays current without anyone touching it.
	onMount(() => {
		const timer = setInterval(() => invalidateAll(), 60_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>AEI · {wardName(data.input.ward)}</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-50 text-slate-900">
	<header class="flex flex-wrap items-center gap-5 border-b border-slate-200 bg-white px-8 py-3">
		<svg width="40" height="40" viewBox="0 0 34 34" aria-hidden="true">
			<rect width="34" height="34" rx="8" fill="#0A6464" />
			<circle cx="17" cy="17" r="9" fill="none" stroke="#fff" stroke-width="2" opacity=".45" />
			<path
				d="M17 8 A9 9 0 0 1 26 17"
				fill="none"
				stroke="#fff"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
			<circle cx="17" cy="17" r="2.6" fill="#fff" />
		</svg>
		<div class="flex flex-col leading-tight">
			<h1 class="text-[26px] font-semibold">{wardName(data.input.ward)}</h1>
			<span class="text-sm text-slate-500">{t.nav.pulse} · AEI</span>
		</div>
		<form method="GET" class="flex items-center gap-2">
			<label class="sr-only" for="station-ward">{t.station.pickWard}</label>
			<select
				id="station-ward"
				name="ward"
				class="min-h-11 rounded-md border-slate-300 text-base"
				onchange={submit}
			>
				{#each data.wards as w (w.code)}
					<option value={w.code} selected={data.input.ward === w.code}
						>{fi ? w.nameFi : w.nameEn}</option
					>
				{/each}
			</select>
			<input type="hidden" name="asOf" value={data.asOf} />
		</form>
		<div class="flex-1"></div>
		<span class="text-[15px] text-slate-600"
			>{t.station.updated}
			<span class="font-mono text-slate-900"
				>{formatDateTime(data.locale, new Date(data.sync.loadedAt))}</span
			></span
		>
		<form method="POST" action={resolve('/locale')} onsubmit={switchLocale}>
			<input type="hidden" name="redirectTo" value={backTo} />
			<div role="group" aria-label={t.language} class="flex rounded-lg bg-slate-100 p-0.5">
				{#each ['fi', 'en'] as const as l (l)}
					<button
						name="locale"
						value={l}
						aria-pressed={data.locale === l}
						class={[
							'min-h-11 rounded-md px-3.5 text-[15px] font-semibold uppercase',
							data.locale === l ? 'bg-slate-900 text-white' : 'text-slate-500'
						]}>{l}</button
					>
				{/each}
			</div>
		</form>
	</header>

	{#if data.primary}
		<section
			aria-labelledby="st-alert"
			class={[
				'flex items-center gap-5 px-8 py-4 text-white',
				data.primary.severity === 'critical' ? 'bg-rose-600' : 'bg-amber-800'
			]}
		>
			<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"
				><path
					d="M17 4 L31 29 H3 Z"
					fill="none"
					stroke="#fff"
					stroke-width="2.4"
					stroke-linejoin="round"
				/><path d="M17 13 V20" stroke="#fff" stroke-width="2.6" stroke-linecap="round" /><circle
					cx="17"
					cy="24.5"
					r="1.6"
					fill="#fff"
				/></svg
			>
			<div>
				<h2 id="st-alert" class="text-2xl font-semibold">
					{alertTitle(
						data.locale,
						{ ...data.primary, ward: data.input.ward },
						wardName(data.input.ward),
						data.primary.antibiotic ? abName(data.primary.antibiotic) : undefined
					)}
				</h2>
				{#if data.primary.cases > 1}
					<p class="text-base opacity-90">
						{t.alert.hospitalOnset}: {data.primary.investigation.hospitalOnset}/{data.primary.cases} ·
						{t.alert.sameProfile}: {data.primary.investigation.sameProfile}/{data.primary.cases}
					</p>
				{/if}
			</div>
		</section>
	{:else}
		<section class="flex items-center gap-4 bg-emerald-50 px-8 py-4 text-emerald-700">
			<svg width="34" height="34" viewBox="0 0 56 56" aria-hidden="true"
				><circle cx="28" cy="28" r="26" fill="#fff" /><path
					d="M18 28.5 L25 35 L38.5 21"
					fill="none"
					stroke="#2E6B45"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
			<h2 class="text-2xl font-semibold">{t.station.calm}</h2>
		</section>
	{/if}

	<div class="grid flex-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
		<section
			aria-labelledby="st-res"
			class="flex flex-col gap-2.5 border-slate-200 px-8 py-6 lg:border-r"
		>
			{#if top}
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h2 id="st-res" class="text-xl font-semibold">
						<span class="italic">{top.organism}</span> · {t.station.resTitle}
					</h2>
					<span class="text-sm text-slate-500">{t.station.resLegend}</span>
				</div>
				{#each bars as b (b.code)}
					<div
						class="grid grid-cols-[200px_minmax(0,1fr)_96px] items-center gap-4 border-b border-slate-200 py-1.5"
					>
						<span class="text-[17px]"
							><span class="font-mono font-semibold">{b.code}</span>
							<span class="text-[15px] text-slate-600">{abName(b.code).split('-')[0]}</span></span
						>
						<div class="relative h-[22px]">
							<div
								class="absolute top-1 left-0 h-3.5 rounded-sm bg-teal-200"
								style:width="{Math.max(b.annual.r ?? 0, 0.8)}%"
							></div>
							{#if b.recent.n}
								<div
									class={[
										'absolute top-[9px] left-0 h-1 rounded-sm',
										b.rise ? 'bg-rose-600' : 'bg-slate-900'
									]}
									style:width="{Math.max(b.recent.r ?? 0, 0.8)}%"
								></div>
							{/if}
						</div>
						<span
							class={[
								'text-right text-[22px] font-semibold tabular-nums',
								b.rise ? 'text-rose-700' : ''
							]}>{b.recent.n ? pct(b.recent.r) : '–'}</span
						>
					</div>
				{/each}
				<p class="mt-1 text-sm text-slate-600">
					{t.specimens[data.input.specimen]} · {t.w4Short} n={top.recentIsolates} · {t.w12Short} n={top.annualIsolates}{top.recentIsolates <
					30
						? ` · ${t.insufficient}`
						: ''}
				</p>
			{:else}
				<p class="text-lg text-slate-500">{t.pulse.noData}</p>
			{/if}
		</section>

		<section aria-labelledby="st-emp" class="flex flex-col gap-3.5 px-8 py-6">
			<h2 id="st-emp" class="text-xl font-semibold">{t.empiric}</h2>
			{#each data.empiric as e (e.site)}
				<div class="rounded-xl border border-slate-200 bg-white px-5 py-4">
					<div class="text-[15px] text-slate-500">{t.pulse.empiricSites[e.key]}</div>
					<div class="mt-1 flex items-baseline justify-between gap-3">
						<span class="text-2xl font-semibold">{e.code ? abName(e.code) : '–'}</span>
						<span
							class={['text-2xl font-semibold', e.adequate ? 'text-emerald-700' : 'text-amber-800']}
							>{pct(e.coverage)}</span
						>
					</div>
					{#if !e.adequate}<div class="mt-0.5 text-sm text-amber-800">
							{t.pulse.noAdequate}
						</div>{/if}
					{#if e.reserve}<div class="mt-0.5 text-sm text-rose-700">
							{t.pulse.reserveSevere(abName(e.reserve.code), pct(e.reserve.coverage))}
						</div>{/if}
				</div>
			{/each}
			{#if data.warned.length}
				<p class="rounded-lg bg-amber-50 px-4 py-3.5 text-base text-amber-800">
					{t.station.avoid(data.warned.map((c) => abName(c)).join(', '))}
				</p>
			{/if}
			<div class="flex-1"></div>
			<p class="text-sm text-slate-500">{t.station.footer}</p>
		</section>
	</div>
</div>
