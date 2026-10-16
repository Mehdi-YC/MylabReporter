<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const pct = (p: number | null) => (p === null ? '–' : `${Math.round(p * 100)} %`);
	const abName = (code: string) => data.antibiotics.find((a) => a.code === code)?.name ?? code;
	const wardName = $derived(data.wards.find((w) => w.code === data.input.ward)?.nameEn);
	const best = $derived(data.options.find((o) => o.code === data.best));
	const fallback = $derived(data.options.find((o) => o.code === data.bestAvailable));
	const unsuitable = (code: string) => data.unsuitable.includes(code);

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
			data.sites.find((s) => s.key === data.input.site)?.label,
			data.input.sex === 'F' ? 'women' : data.input.sex === 'M' ? 'men' : null,
			data.input.age ? `age ${data.ageGroups.find((g) => g.key === data.input.age)?.label}` : null,
			data.input.onset === 'hospital'
				? 'hospital-onset'
				: data.input.onset === 'community'
					? 'community / early'
					: null
		]
			.filter(Boolean)
			.join(' · ')
	);

	const submit = (e: Event) =>
		(e.currentTarget as HTMLSelectElement | HTMLInputElement).form?.requestSubmit();
</script>

<section class="mb-5">
	<h1 class="text-2xl font-semibold tracking-tight">Empirical therapy advisor</h1>
	<p class="mt-1 max-w-3xl text-slate-600">
		Before culture results are back: how likely is each antibiotic to cover the pathogen of a
		patient like this one, in this ward, given the last 12 months of results and today's alerts.
	</p>
</section>

<div class="grid gap-5 lg:grid-cols-[18rem_1fr]">
	<form
		method="GET"
		class="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4"
	>
		<h2 class="font-semibold">Patient</h2>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Ward</span>
			<select name="ward" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each data.wards as w (w.code)}
					<option value={w.code} selected={data.input.ward === w.code}>{w.code} · {w.nameEn}</option
					>
				{/each}
			</select>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Suspected infection</span>
			<select name="site" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each data.sites as site (site.key)}
					<option value={site.key} selected={data.input.site === site.key}>{site.label}</option>
				{/each}
			</select>
		</label>
		<div class="grid grid-cols-2 gap-3">
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">Sex</span>
				<select name="sex" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
					<option value="" selected={!data.input.sex}>Any</option>
					<option value="F" selected={data.input.sex === 'F'}>Female</option>
					<option value="M" selected={data.input.sex === 'M'}>Male</option>
				</select>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">Age</span>
				<select name="age" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
					<option value="" selected={!data.input.age}>Any</option>
					{#each data.ageGroups as g (g.key)}
						<option value={g.key} selected={data.input.age === g.key}>{g.label}</option>
					{/each}
				</select>
			</label>
		</div>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Onset</span>
			<select name="onset" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				<option value="" selected={!data.input.onset}>Any</option>
				<option value="community" selected={data.input.onset === 'community'}
					>Community / first 2 days</option
				>
				<option value="hospital" selected={data.input.onset === 'hospital'}
					>Hospital day 3 or later</option
				>
			</select>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Coverage target</span>
			<select name="target" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each data.targets as t (t)}
					<option value={t} selected={data.input.target === t}>{t * 100} %</option>
				{/each}
			</select>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Date</span>
			<input
				type="date"
				name="asOf"
				value={data.input.asOf}
				min={data.range.first}
				max={data.range.last}
				class="w-full rounded-md border-slate-300 text-sm"
				onchange={submit}
			/>
		</label>
		<noscript><button class="rounded-md bg-teal-700 px-3 py-2 text-white">Update</button></noscript>
	</form>

	<div class="space-y-5">
		<section class="rounded-xl border border-slate-200 bg-white p-4 text-sm">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					Based on <span class="font-semibold">{data.context.isolates}</span> first isolates ·
					<span class="font-medium">{profile}</span> · {data.windows.annual.from} → {data.windows
						.annual.to}
				</div>
				<span class="text-slate-500">{wardName}</span>
			</div>
			{#if data.context.fallback}
				<p class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
					Fewer than 30 isolates in {data.input.ward} for this profile: coverage is computed from all
					wards. The last-4-weeks column and the alerts are still specific to {data.input.ward}.
				</p>
			{/if}
			{#if data.alerts.length}
				<a
					href="{resolve('/alerts')}?asOf={data.input.asOf}"
					class="mt-2 block rounded-md bg-rose-50 px-3 py-2 text-rose-900 hover:bg-rose-100"
				>
					⚠ {data.alerts.length} active alert{data.alerts.length > 1 ? 's' : ''} in {data.input
						.ward}: they are taken into account below. View alerts →
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
				<div class="text-sm text-emerald-900">
					Narrowest option reaching {data.input.target * 100} % coverage, no active warning
				</div>
				<div class="mt-1 text-xl font-semibold">
					{abName(best.code)}
					<span class="text-base font-normal text-slate-600"
						>{pct(best.coverage.p)} ({pct(best.coverage.low)}–{pct(best.coverage.high)})</span
					>
				</div>
				{#if data.notes[best.code]}<div class="mt-1 text-sm text-slate-700">
						{data.notes[best.code].note}
					</div>{/if}
			{:else}
				<div class="text-sm text-amber-900">
					No single agent reaches {data.input.target * 100} % coverage for this profile{fallback
						? '. Highest coverage without active warning:'
						: '.'}
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
						Best two-drug combination:
						<span class="font-semibold"
							>{abName(data.combination.codes[0])} + {abName(data.combination.codes[1])}</span
						>
						covers {pct(data.combination.coverage.p)} ({pct(data.combination.coverage.low)}–{pct(
							data.combination.coverage.high
						)})
					</div>
				{/if}
				<div class="mt-2 text-sm text-amber-900">
					Take cultures before treatment; consider a combination and discuss with infectious
					diseases if the patient is severely ill.
				</div>
			{/if}
			{#if data.gaps.length}
				<div class="mt-2 text-sm text-slate-700">
					Not covered: {#each data.gaps as g, i (g.organism)}<span class="italic">{g.organism}</span
						>
						({pct(g.share)}){i < data.gaps.length - 1 ? ', ' : ''}{/each}
				</div>
			{/if}
		</section>

		<section class="rounded-xl border border-slate-200 bg-white">
			<div
				class="grid grid-cols-[minmax(9rem,1.2fr)_2fr_4.5rem_4.5rem] gap-3 border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 uppercase"
			>
				<span>Antibiotic</span><span>Coverage, 12 months (95 % CI)</span><span class="text-right"
					>12 mo</span
				><span class="text-right">4 wk</span>
			</div>
			{#each data.options as o (o.code)}
				<div
					class={[
						'grid grid-cols-[minmax(9rem,1.2fr)_2fr_4.5rem_4.5rem] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0',
						unsuitable(o.code) && 'opacity-45',
						o.code === data.best && 'bg-emerald-50/60'
					]}
				>
					<div>
						<div class="font-medium">
							{abName(o.code)} <span class="text-xs text-slate-400">{o.code}</span>
						</div>
						{#if data.notes[o.code]?.tag}
							<span
								class="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
								>{unsuitable(o.code) ? 'not for this site' : data.notes[o.code].tag}</span
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
								title="Target"
							></div>
						</div>
						{#each o.warnings as w (w)}
							<div class="mt-1 text-xs font-medium text-rose-700">⚠ {w}</div>
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
						title={o.recent ? `${o.recent.k}/${o.recent.n} isolates in ${data.input.ward}` : ''}
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
			<h2 class="mb-3 font-semibold">Most likely organisms for this profile</h2>
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

		<p class="text-xs text-slate-500">
			Decision support only: coverage is the share of first isolates from similar patients that were
			susceptible (an organism not tested for a drug counts as not covered). It does not replace
			local treatment guidelines, allergy and severity assessment, or clinical judgement. The black
			tick on each bar is the coverage target; the bracket is the 95 % confidence interval.
		</p>
	</div>
</div>
