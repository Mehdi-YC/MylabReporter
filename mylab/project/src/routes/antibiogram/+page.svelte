<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import TrendChart from '#lib/components/TrendChart.svelte';
	import type { Proportion } from '#lib/amr/stats.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const pct = (p: number | null) => (p === null ? '–' : `${Math.round(p * 100)}`);

	function tone(share: Proportion | null): string {
		if (!share || share.p === null) return 'bg-slate-50 text-slate-400';
		if (!share.reliable) return 'bg-slate-50 text-slate-500';
		if (share.p >= 0.9) return 'bg-emerald-100 text-emerald-900';
		if (share.p >= 0.8) return 'bg-lime-100 text-lime-900';
		if (share.p >= 0.6) return 'bg-amber-100 text-amber-900';
		return 'bg-rose-100 text-rose-900';
	}

	/** Current filters plus the selected organism × antibiotic, as a query string. */
	function cellQuery(organism: string, code: string): string {
		const params = Object.fromEntries(page.url.searchParams);
		return new URLSearchParams({ ...params, organism, ab: code }).toString();
	}

	const wardLabel = $derived(
		data.filter.ward
			? `${data.filter.ward} · ${data.wards.find((w) => w.code === data.filter.ward)?.nameEn}`
			: 'All wards'
	);

	const submit = (e: Event) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit();
</script>

<section class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Ward antibiogram</h1>
		<p class="mt-1 text-slate-600">
			% of first isolates susceptible: last 12 months (large) and last 4 weeks (small).
		</p>
	</div>
	<div class="text-right text-sm text-slate-500">
		<div>4 weeks: {data.windows.recent.from} → {data.windows.recent.to}</div>
		<div>12 months: {data.windows.annual.from} → {data.windows.annual.to}</div>
	</div>
</section>

<form
	method="GET"
	class="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
>
	<label class="text-sm">
		<span class="mb-1 block font-medium text-slate-700">Ward</span>
		<select name="ward" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
			<option value="" selected={!data.filter.ward}>All wards</option>
			{#each data.wards as w (w.code)}
				<option value={w.code} selected={data.filter.ward === w.code}>{w.code} · {w.nameEn}</option>
			{/each}
		</select>
	</label>
	<label class="text-sm">
		<span class="mb-1 block font-medium text-slate-700">Specimen</span>
		<select name="specimen" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
			{#each ['urine', 'blood', 'wound'] as s (s)}
				<option value={s} selected={data.filter.specimen === s}>{s}</option>
			{/each}
		</select>
	</label>
	<label class="text-sm">
		<span class="mb-1 block font-medium text-slate-700">Sex</span>
		<select name="sex" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
			<option value="" selected={!data.filter.sex}>All</option>
			<option value="F" selected={data.filter.sex === 'F'}>Women</option>
			<option value="M" selected={data.filter.sex === 'M'}>Men</option>
		</select>
	</label>
	<label class="text-sm">
		<span class="mb-1 block font-medium text-slate-700">Onset</span>
		<select name="onset" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
			<option value="" selected={!data.filter.onset}>All</option>
			<option value="community" selected={data.filter.onset === 'community'}
				>Community / early</option
			>
			<option value="hospital" selected={data.filter.onset === 'hospital'}
				>Hospital-onset (day ≥ 3)</option
			>
		</select>
	</label>
	<label class="text-sm">
		<span class="mb-1 block font-medium text-slate-700">Reference date</span>
		<input
			type="date"
			name="asOf"
			value={data.asOf}
			min={data.range.first}
			max={data.range.last}
			class="w-full rounded-md border-slate-300 text-sm"
			onchange={submit}
		/>
	</label>
	{#if data.trend}
		<input type="hidden" name="organism" value={data.trend.organism} />
		<input type="hidden" name="ab" value={data.trend.antibiotic.code} />
	{/if}
	<noscript><button class="rounded-md bg-teal-700 px-3 py-2 text-white">Apply</button></noscript>
</form>

<section class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
	{#if data.rows.length === 0}
		<p class="p-6 text-slate-500">No isolates match these filters in the last 12 months.</p>
	{:else}
		<table class="w-full border-separate border-spacing-1 p-2 text-sm">
			<thead>
				<tr class="text-xs text-slate-500">
					<th class="sticky left-0 bg-white px-2 py-1 text-left font-medium">
						{wardLabel} · {data.filter.specimen}
					</th>
					<th class="px-1 py-1 text-right font-medium" title="First isolates, 12 months / 4 weeks"
						>n</th
					>
					{#each data.antibiotics as ab (ab.code)}
						<th class="min-w-14 px-1 py-1 font-medium" title="{ab.name} ({ab.class})">
							<div class="font-semibold text-slate-700">{ab.code}</div>
							<div class="truncate text-[10px] font-normal">{ab.name.split('-')[0]}</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.rows as row (row.organism)}
					<tr>
						<th
							class="sticky left-0 bg-white px-2 py-1 text-left font-medium whitespace-nowrap italic"
							>{row.organism}</th
						>
						<td class="px-1 text-right text-xs whitespace-nowrap text-slate-500 tabular-nums">
							{row.annualIsolates}<span class="text-slate-400"> / {row.recentIsolates}</span>
						</td>
						{#each data.antibiotics as ab (ab.code)}
							{@const cell = row.cells[ab.code]}
							{#if cell}
								<td class="p-0">
									<a
										href="{resolve('/antibiogram')}?{cellQuery(row.organism, ab.code)}#trend"
										class={[
											'block rounded-md px-1 py-1 text-center ring-teal-600 transition hover:ring-2',
											tone(cell.annual),
											data.trend?.organism === row.organism &&
												data.trend?.antibiotic.code === ab.code &&
												'ring-2'
										]}
										title="12 mo: {cell.annual.k}/{cell.annual.n} S{cell.recent
											? ` · 4 wk: ${cell.recent.k}/${cell.recent.n} S`
											: ''}{cell.hospital && !cell.annual.reliable
											? ` · all wards: ${pct(cell.hospital.p)} %`
											: ''}"
									>
										<div class="text-base leading-tight font-semibold tabular-nums">
											{pct(cell.annual.p)}{#if !cell.annual.reliable}<sup class="text-[9px]">*</sup
												>{/if}
										</div>
										<div
											class={[
												'text-[10px] leading-tight tabular-nums',
												cell.drop ? 'font-bold text-rose-700' : 'opacity-70'
											]}
										>
											{cell.drop ? '▼ ' : ''}{cell.recent ? pct(cell.recent.p) : '–'}
										</div>
									</a>
								</td>
							{:else}
								<td class="text-center text-slate-300">·</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<div
		class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"
	>
		<span class="flex items-center gap-1"
			><span class="size-3 rounded bg-emerald-100"></span> ≥ 90 %</span
		>
		<span class="flex items-center gap-1"
			><span class="size-3 rounded bg-lime-100"></span> 80–89 %</span
		>
		<span class="flex items-center gap-1"
			><span class="size-3 rounded bg-amber-100"></span> 60–79 %</span
		>
		<span class="flex items-center gap-1"
			><span class="size-3 rounded bg-rose-100"></span> &lt; 60 %</span
		>
		<span>* fewer than 30 isolates: indicative only (hover for the all-wards value)</span>
		<span class="font-semibold text-rose-700">▼ last 4 weeks significantly below 12 months</span>
		<span>Click a cell for the monthly trend.</span>
	</div>
</section>

{#if data.trend}
	<section id="trend" class="mt-5 rounded-xl border border-slate-200 bg-white p-5">
		<h2 class="font-semibold">
			<span class="italic">{data.trend.organism}</span> – {data.trend.antibiotic.name}: monthly %
			susceptible
		</h2>
		<p class="mb-3 text-sm text-slate-500">{wardLabel} · {data.filter.specimen} · last 24 months</p>
		<TrendChart
			selected={data.trend.selected}
			reference={data.trend.hospital}
			selectedLabel={wardLabel}
		/>
	</section>
{/if}
