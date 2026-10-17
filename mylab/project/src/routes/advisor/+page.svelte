<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate, messages } from '#lib/i18n.ts';
	import type { WarningItem } from '#lib/amr/advisor.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const m = $derived(messages[data.locale]);
	const t = $derived(m.advisor);
	const fi = $derived(data.locale === 'fi');
	const pct = (p: number | null) => (p === null ? '–' : `${Math.round(p * 100)} %`);
	const abName = (code: string) => {
		const a = data.antibiotics.find((x) => x.code === code);
		return a ? (fi ? a.nameFi : a.name) : code;
	};
	const ward = $derived(data.wards.find((w) => w.code === data.input.ward));
	const wardName = $derived(ward ? (fi ? ward.nameFi : ward.nameEn) : data.input.ward);
	const best = $derived(data.options.find((o) => o.code === data.best));
	const fallback = $derived(data.options.find((o) => o.code === data.bestAvailable));
	const reserve = $derived(data.options.find((o) => o.code === data.reserve));
	const unsuitable = (code: string) => data.unsuitable.includes(code);
	const tag = (code: string) => {
		const raw = data.notes[code]?.tag;
		return raw ? (t.tags[raw] ?? raw) : null;
	};
	const note = (code: string) => t.notes[code] ?? data.notes[code]?.note ?? null;
	const warning = (w: WarningItem) =>
		w.kind === 'rise'
			? t.warnings.rise(w.organism, w.observed, w.expected)
			: w.kind === 'esbl' || w.kind === 'mrsa'
				? t.warnings[w.kind](w.cases)
				: t.warnings[w.kind];

	function barTone(p: number | null): string {
		if (p === null) return 'bg-slate-300';
		if (p >= 0.9) return 'bg-emerald-500';
		if (p >= 0.8) return 'bg-lime-500';
		if (p >= 0.6) return 'bg-amber-400';
		return 'bg-rose-400';
	}

	const profile = $derived(
		[
			data.input.ward,
			t.sites[data.input.site],
			data.input.sex === 'F' ? t.women : data.input.sex === 'M' ? t.men : null,
			data.input.age
				? t.ageOf(data.ageGroups.find((g) => g.key === data.input.age)?.label ?? '')
				: null,
			data.input.onset === 'hospital'
				? t.onsetShortHospital
				: data.input.onset === 'community'
					? t.onsetShortCommunity
					: null
		]
			.filter(Boolean)
			.join(' · ')
	);

	/** Same ward on the resistance page, optionally with one drug's trend open. */
	function antibiogramQuery(code?: string): string {
		const params: Record<string, string | undefined> = {
			ward: data.input.ward,
			specimen: data.input.specimen,
			asOf: data.input.asOf
		};
		const organism = code ? data.trendOrganism[code] : null;
		if (code && organism) Object.assign(params, { cellOrg: organism, cellAb: code });
		return new URLSearchParams(
			Object.entries(params).filter((e): e is [string, string] => !!e[1])
		).toString();
	}

	const submit = (e: Event) =>
		(e.currentTarget as HTMLSelectElement | HTMLInputElement).form?.requestSubmit();
</script>

<section class="mb-5">
	<h1 class="text-2xl font-semibold tracking-tight">{t.title}</h1>
	<p class="mt-1 max-w-3xl text-slate-600">{t.intro}</p>
</section>

<div class="grid gap-5 lg:grid-cols-[18rem_1fr]">
	<form
		method="GET"
		class="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4"
	>
		<h2 class="font-semibold">{t.patient}</h2>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">{t.ward}</span>
			<select name="ward" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each data.wards as w (w.code)}
					<option value={w.code} selected={data.input.ward === w.code}
						>{w.code} · {fi ? w.nameFi : w.nameEn}</option
					>
				{/each}
			</select>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">{t.site}</span>
			<select name="site" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each data.sites as site (site.key)}
					<option value={site.key} selected={data.input.site === site.key}
						>{t.sites[site.key] ?? site.label}</option
					>
				{/each}
			</select>
		</label>
		<div class="grid grid-cols-2 gap-3">
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">{t.sex}</span>
				<select name="sex" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
					<option value="" selected={!data.input.sex}>{t.any}</option>
					<option value="F" selected={data.input.sex === 'F'}>{t.female}</option>
					<option value="M" selected={data.input.sex === 'M'}>{t.male}</option>
				</select>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">{t.age}</span>
				<select name="age" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
					<option value="" selected={!data.input.age}>{t.any}</option>
					{#each data.ageGroups as g (g.key)}
						<option value={g.key} selected={data.input.age === g.key}>{g.label}</option>
					{/each}
				</select>
			</label>
		</div>
		<!-- Rarely changed: kept one tap away, with the current values in the summary. -->
		<details class="rounded-md border border-slate-200 text-sm" open={!!data.input.onset}>
			<summary
				class="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-slate-600 [&::-webkit-details-marker]:hidden"
			>
				<span
					><span class="font-medium text-slate-800">{t.more}</span> · {data.input.onset
						? data.input.onset === 'hospital'
							? t.onsetShortHospital
							: t.onsetShortCommunity
						: t.onsetAny} · {t.targetShort(data.input.target * 100)} · {formatDate(
						data.locale,
						data.input.asOf
					)}</span
				><span aria-hidden="true" class="text-xs">▾</span>
			</summary>
			<div class="space-y-3 border-t border-slate-200 p-3">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-slate-700">{t.onset}</span>
					<select name="onset" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
						<option value="" selected={!data.input.onset}>{t.any}</option>
						<option value="community" selected={data.input.onset === 'community'}
							>{t.onsetCommunity}</option
						>
						<option value="hospital" selected={data.input.onset === 'hospital'}
							>{t.onsetHospital}</option
						>
					</select>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-slate-700">{t.target}</span>
					<select
						name="target"
						class="w-full rounded-md border-slate-300 text-sm"
						onchange={submit}
					>
						{#each data.targets as target (target)}
							<option value={target} selected={data.input.target === target}
								>{target * 100} %</option
							>
						{/each}
					</select>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-slate-700">{t.date}</span>
					<input
						type="date"
						name="asOf"
						value={data.input.asOf}
						min={data.range.first}
						max={data.range.last}
						class="w-full rounded-md border-slate-300 text-base sm:text-sm"
						onchange={submit}
					/>
				</label>
			</div>
		</details>
		<noscript
			><button class="rounded-md bg-teal-700 px-3 py-2 text-white">{t.update}</button></noscript
		>
	</form>

	<div class="space-y-5">
		<section class="rounded-xl border border-slate-200 bg-white p-4 text-sm">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<span class="font-semibold">{t.basedOn(data.context.isolates)}</span> ·
					<span class="font-medium">{profile}</span> · {formatDate(
						data.locale,
						data.windows.annual.from
					)} → {formatDate(data.locale, data.windows.annual.to)}
				</div>
				<span class="text-slate-500">{wardName}</span>
			</div>
			<a
				href="{resolve('/')}?{antibiogramQuery()}"
				class="mt-2 inline-block text-teal-700 hover:underline"
				>{t.perOrganism(
					data.input.ward,
					m.specimens[data.input.specimen as 'urine'] ?? data.input.specimen
				)}</a
			>
			{#if data.context.fallback}
				<p class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
					{t.fallback(data.input.ward)}
				</p>
			{/if}
			{#if data.alerts.length}
				<a
					href="{resolve('/alerts')}?asOf={data.input.asOf}"
					class="mt-2 block rounded-md bg-rose-50 px-3 py-2 text-rose-900 hover:bg-rose-100"
				>
					{t.alerts(data.alerts.length, data.input.ward)}
				</a>
			{/if}
		</section>

		<section
			class={[
				'rounded-xl border p-5',
				best ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'
			]}
		>
			{#if best}
				<div class="text-sm text-emerald-900">{t.narrowest(data.input.target * 100)}</div>
				<div class="mt-1 text-xl font-semibold">
					{abName(best.code)}
					<span class="text-base font-normal text-slate-600"
						>{pct(best.coverage.p)} ({pct(best.coverage.low)}–{pct(best.coverage.high)})</span
					>
				</div>
				{#if note(best.code)}<div class="mt-1 text-sm text-slate-700">{note(best.code)}</div>{/if}
			{:else}
				<div class="text-sm text-amber-900">
					{t.noneReach(data.input.target * 100)}
					{#if fallback}<span>{t.highest}</span>{/if}
				</div>
				{#if fallback}
					<div class="mt-1 text-xl font-semibold">
						{abName(fallback.code)}
						<span class="text-base font-normal text-slate-600"
							>{pct(fallback.coverage.p)} ({pct(fallback.coverage.low)}–{pct(
								fallback.coverage.high
							)})</span
						>
					</div>
				{/if}
				{#if data.combination}
					<div class="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm">
						{t.combination}
						<span class="font-semibold"
							>{abName(data.combination.codes[0])} + {abName(data.combination.codes[1])}</span
						>
						{t.covers}
						{pct(data.combination.coverage.p)} ({pct(data.combination.coverage.low)}–{pct(
							data.combination.coverage.high
						)})
					</div>
				{/if}
				{#if reserve}
					<div
						class="mt-3 rounded-lg border border-rose-200 bg-white/80 px-3 py-2 text-sm text-rose-900"
					>
						{t.reserve}
						<span class="font-semibold">{abName(reserve.code)}</span>
						{pct(reserve.coverage.p)} · {note(reserve.code)}
					</div>
				{/if}
				<div class="mt-2 text-sm text-amber-900">{t.advice}</div>
			{/if}
			{#if data.gaps.length}
				<div class="mt-2 text-sm text-slate-700">
					{t.notCovered}
					{#each data.gaps as g, i (g.organism)}<span class="italic">{g.organism}</span>
						({pct(g.share)}){i < data.gaps.length - 1 ? ', ' : ''}{/each}
				</div>
			{/if}
		</section>

		<section class="rounded-xl border border-slate-200 bg-white">
			<div
				class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_3rem_3rem] gap-3 border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 uppercase sm:grid-cols-[minmax(9rem,1.2fr)_2fr_4.5rem_4.5rem]"
			>
				<span>{t.colAntibiotic}</span><span>{t.colCoverage}</span><span class="text-right"
					>{t.col12}</span
				><span class="text-right">{t.col4}</span>
			</div>
			{#each data.options as o (o.code)}
				<div
					class={[
						'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_3rem_3rem] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 sm:grid-cols-[minmax(9rem,1.2fr)_2fr_4.5rem_4.5rem]',
						unsuitable(o.code) && 'opacity-45',
						o.code === data.best && 'bg-emerald-50/60'
					]}
				>
					<div>
						<div class="font-medium break-words">
							{abName(o.code)} <span class="text-xs text-slate-400">{o.code}</span>
						</div>
						{#if data.trendOrganism[o.code]}
							<a
								href="{resolve('/')}?{antibiogramQuery(o.code)}#detail"
								class="text-[11px] text-teal-700 hover:underline"
								title={t.trendTitle(abName(o.code), data.trendOrganism[o.code] ?? '')}
								>{t.trend} · <span class="italic">{data.trendOrganism[o.code]}</span></a
							>
						{/if}
						{#if tag(o.code)}
							<span
								class={[
									'mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px]',
									data.notes[o.code]?.tag === 'reserve'
										? 'bg-rose-50 text-rose-700'
										: 'bg-slate-100 text-slate-600'
								]}>{unsuitable(o.code) ? t.notForSite : tag(o.code)}</span
							>
						{/if}
					</div>
					<div>
						<div class="relative h-3 rounded-full bg-slate-100">
							<div
								class={['absolute inset-y-0 left-0 rounded-full', barTone(o.coverage.p)]}
								style:width="{(o.coverage.p ?? 0) * 100}%"
							></div>
							{#if o.coverage.low !== null}
								<div
									class="absolute inset-y-[-3px] border-x-2 border-slate-700/60"
									style:left="{o.coverage.low * 100}%"
									style:width="{((o.coverage.high ?? 0) - o.coverage.low) * 100}%"
								></div>
							{/if}
							<div
								class="absolute inset-y-[-4px] w-px bg-slate-900"
								style:left="{data.input.target * 100}%"
								title={t.targetTick}
							></div>
						</div>
						{#each data.warningItems[o.code] ?? [] as w (JSON.stringify(w))}
							<div class="mt-1 text-xs font-medium text-rose-700">⚠ {warning(w)}</div>
						{/each}
					</div>
					<div class="text-right font-semibold tabular-nums">{pct(o.coverage.p)}</div>
					<div
						class={[
							'text-right text-sm tabular-nums',
							o.recent &&
							o.recent.n >= 10 &&
							o.coverage.p !== null &&
							o.recent.p !== null &&
							o.recent.p < o.coverage.p - 0.1
								? 'font-semibold text-rose-700'
								: 'text-slate-500'
						]}
						title={o.recent ? t.recentTitle(o.recent.k, o.recent.n, data.input.ward) : ''}
					>
						{#if o.recent && o.recent.n > 0}
							<span class={o.recent.n < 10 ? 'text-slate-400' : ''}>{pct(o.recent.p)}</span>
							<div class="text-[10px] text-slate-400">n = {o.recent.n}</div>
						{:else}–{/if}
					</div>
				</div>
			{/each}
		</section>

		<section class="rounded-xl border border-slate-200 bg-white p-4">
			<h2 class="mb-3 font-semibold">{t.organisms}</h2>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each data.organisms as org (org.organism)}
					<div class="flex items-center gap-3 text-sm">
						<span class="w-48 truncate italic">{org.organism}</span>
						<div class="h-2 flex-1 rounded-full bg-slate-100">
							<div class="h-2 rounded-full bg-teal-600" style:width="{org.share * 100}%"></div>
						</div>
						<span class="w-10 text-right text-slate-600 tabular-nums">{pct(org.share)}</span>
					</div>
				{/each}
			</div>
		</section>

		<p class="text-xs text-slate-500">{t.disclaimer}</p>
	</div>
</div>
