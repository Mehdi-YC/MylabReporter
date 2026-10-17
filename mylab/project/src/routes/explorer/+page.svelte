<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatPercent, formatRange, messages } from '#lib/i18n.ts';
	import type { Proportion } from '#lib/amr/stats.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const t = $derived(messages[data.locale]);
	const fi = $derived(data.locale === 'fi');
	const w4 = $derived(data.input.window === '4w');
	const pct = (p: number | null) => formatPercent(data.locale, p === null ? null : p * 100);
	const abName = (code: string) => {
		const a = data.antibiotics.find((x) => x.code === code);
		return a ? (fi ? a.nameFi : a.name) : code;
	};
	const ward = (code: string) => data.wards.find((w) => w.code === code)!;
	const submit = (e: Event) =>
		(e.currentTarget as HTMLSelectElement | HTMLInputElement).form?.requestSubmit();

	// svelte-ignore state_referenced_locally
	let selected = $state<{ ward: string; code: string } | null>(data.selected);

	const tint = (s: Proportion) => {
		if (!s.reliable || s.p === null) return 'bg-slate-100 text-slate-400';
		if (s.p >= 0.25) return 'bg-rose-50 text-rose-700';
		if (s.p >= 0.1) return 'bg-amber-50 text-slate-900';
		return 'bg-white text-slate-900';
	};

	const detail = $derived.by(() => {
		if (!selected) return null;
		const row = data.rows.find((r) => r.ward === selected!.ward);
		const cell = row?.cells.find((c) => c.code === selected!.code);
		return cell ? { ward: ward(selected.ward), cell } : null;
	});

	const trendQuery = $derived(
		detail
			? new URLSearchParams({
					ward: detail.ward.code,
					specimen: data.input.specimen || 'urine',
					organism: data.input.organism,
					ab: detail.cell.code,
					asOf: data.asOf
				}).toString()
			: ''
	);
</script>

<form
	method="GET"
	class="-mx-4 -mt-6 mb-6 border-b border-slate-200 bg-white px-4 py-3 sm:-mx-8 sm:px-8"
>
	<div class="flex flex-wrap items-end gap-4">
		<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
			{t.organism}
			<select
				name="organism"
				class="min-h-10 rounded-md border-slate-300 text-sm text-slate-900 italic"
				onchange={submit}
			>
				{#each data.organisms as o (o)}
					<option value={o} selected={data.input.organism === o}>{o}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
			{t.specimen}
			<select
				name="specimen"
				class="min-h-10 rounded-md border-slate-300 text-sm text-slate-900"
				onchange={submit}
			>
				<option value="" selected={!data.input.specimen}>{t.allSpecimens}</option>
				{#each ['urine', 'blood', 'wound'] as const as s (s)}
					<option value={s} selected={data.input.specimen === s}>{t.specimens[s]}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
			{t.onset}
			<select
				name="onset"
				class="min-h-10 rounded-md border-slate-300 text-sm text-slate-900"
				onchange={submit}
			>
				<option value="" selected={!data.input.onset}>{t.onsetAll}</option>
				<option value="hospital" selected={data.input.onset === 'hospital'}
					>{t.onsetHospital}</option
				>
				<option value="community" selected={data.input.onset === 'community'}
					>{t.onsetCommunity}</option
				>
			</select>
		</label>
		<fieldset class="flex flex-col gap-1">
			<legend class="mb-1 text-xs font-medium text-slate-500">{t.window}</legend>
			<div class="flex rounded-lg bg-slate-100 p-0.5">
				{#each [['4w', t.w4], ['12m', t.w12]] as [value, label] (value)}
					<label
						class={[
							'flex min-h-9 cursor-pointer items-center rounded-md px-3 text-sm font-medium',
							data.input.window === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
						]}
					>
						<input
							type="radio"
							name="window"
							{value}
							checked={data.input.window === value}
							class="sr-only"
							onchange={submit}
						/>{label}
					</label>
				{/each}
			</div>
		</fieldset>
		<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
			{t.asOf}
			<input
				type="date"
				name="asOf"
				value={data.asOf}
				min={data.range.first}
				max={data.range.last}
				class="min-h-10 rounded-md border-slate-300 text-sm text-slate-900"
				onchange={submit}
			/>
		</label>
		<noscript
			><button class="min-h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
				>{t.update}</button
			></noscript
		>
	</div>
</form>

<div class="flex flex-col gap-5">
	<div>
		<h1 class="text-[28px] font-semibold tracking-tight">{t.explorer.title}</h1>
		<p class="mt-1 max-w-3xl text-sm text-slate-600">{t.explorer.subtitle}</p>
	</div>

	<div class="flex flex-wrap items-start gap-6">
		<section aria-labelledby="matrix" class="min-w-0 flex-[999_1_720px]">
			<div class="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="matrix" class="text-[17px] font-semibold">
					{t.explorer.matrix(data.input.organism, w4 ? t.w4 : t.w12)}
				</h2>
				<span class="text-xs text-slate-500"
					>{formatRange(data.locale, w4 ? data.windows.recent : data.windows.annual)}</span
				>
			</div>
			<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white px-2 py-1">
				<table class="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
					<thead>
						<tr class="text-xs text-slate-500">
							<th class="px-2 py-2 text-left font-medium">{t.ward}</th>
							{#each data.antibiotics as a (a.code)}
								<th class="px-1 py-2 text-center font-medium" title={fi ? a.nameFi : a.name}>
									<span class="block font-mono font-semibold text-slate-900">{a.code}</span>
									<span class="block truncate text-[11px]"
										>{(fi ? a.nameFi : a.name).split('-')[0].slice(0, 11)}</span
									>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each data.rows as row (row.ward)}
							{@const w = ward(row.ward)}
							<tr>
								<th scope="row" class="px-2 py-1.5 text-left font-medium whitespace-nowrap">
									<span class="mr-1.5 font-mono text-xs text-slate-500">{w.code}</span>{fi
										? w.nameFi
										: w.nameEn}
								</th>
								{#each row.cells as cell (cell.code)}
									{@const s = w4 ? cell.recent : cell.annual}
									{@const on = selected?.ward === row.ward && selected?.code === cell.code}
									<td class="p-0">
										<button
											type="button"
											aria-pressed={on}
											aria-label="{w.code} {abName(cell.code)}: {s.reliable
												? pct(s.p)
												: t.insufficient}"
											onclick={() => (selected = { ward: row.ward, code: cell.code })}
											class={[
												'block min-h-[52px] w-full rounded-md border px-1 py-2 text-center transition',
												tint(s),
												on
													? 'border-teal-700 ring-1 ring-teal-700'
													: 'border-transparent hover:border-slate-300'
											]}
										>
											<span class="block font-semibold tabular-nums"
												>{s.reliable ? pct(s.p) : '—'}</span
											>
											<span class="block text-[11px] text-slate-500"
												>n={s.n}{s.reliable ? '' : ' · n<30'}</span
											>
										</button>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
				<span class="flex items-center gap-1.5"
					><span class="size-3.5 rounded-sm border border-slate-200 bg-white"></span>{t.explorer
						.legendLow}</span
				>
				<span class="flex items-center gap-1.5"
					><span class="size-3.5 rounded-sm bg-amber-50"></span>{t.explorer.legendMid}</span
				>
				<span class="flex items-center gap-1.5"
					><span class="size-3.5 rounded-sm bg-rose-50"></span>{t.explorer.legendHigh}</span
				>
				<span class="flex items-center gap-1.5"
					><span class="size-3.5 rounded-sm bg-slate-100"></span>{t.insufficient}</span
				>
			</div>
		</section>

		<aside
			aria-labelledby="detail"
			class="flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
		>
			{#if detail}
				<div>
					<div class="text-xs text-slate-500">{t.explorer.selected}</div>
					<h2 id="detail" class="mt-0.5 text-lg font-semibold">
						{fi ? detail.ward.nameFi : detail.ward.nameEn} ({detail.ward.code})
					</h2>
					<p class="text-sm text-slate-600">
						<span class="italic">{data.input.organism}</span> · {abName(detail.cell.code)} ({detail
							.cell.code})
					</p>
				</div>
				{#each [[t.w4, detail.cell.recent], [t.w12, detail.cell.annual]] as [label, s] (label)}
					{@const share = s as Proportion}
					<div class="border-t border-slate-100 pt-3">
						<div class="flex items-baseline justify-between">
							<span class="text-sm text-slate-500">{label}</span>
							<span
								class={[
									'text-2xl font-semibold',
									!share.reliable ? 'text-slate-400' : (share.p ?? 0) >= 0.25 ? 'text-rose-700' : ''
								]}>{share.reliable ? pct(share.p) : '—'}</span
							>
						</div>
						{#if share.low !== null && share.high !== null}
							<div class="relative my-2 h-2 rounded bg-slate-100">
								<div
									class={[
										'absolute inset-y-0 rounded',
										share.reliable ? 'bg-teal-200' : 'bg-slate-300'
									]}
									style:left="{share.low * 100}%"
									style:width="{(share.high - share.low) * 100}%"
								></div>
								<div
									class="absolute -inset-y-1 w-0.5 bg-slate-900"
									style:left="{(share.p ?? 0) * 100}%"
								></div>
							</div>
							<div class="text-xs text-slate-600">
								{share.k}/{share.n}
								{t.explorer.resistantOf} · {t.explorer.ci}
								{pct(share.low)}–{pct(share.high)}{share.reliable ? '' : ` · ${t.insufficient}`}
							</div>
						{:else}
							<div class="text-xs text-slate-500">n=0</div>
						{/if}
					</div>
				{/each}
				<a
					href="{resolve('/antibiogram')}?{trendQuery}#trend"
					class="text-sm font-medium text-teal-700 hover:underline">{t.explorer.openTrend} →</a
				>
			{:else}
				<h2 id="detail" class="text-lg font-semibold">{t.explorer.selected}</h2>
				<p class="text-sm text-slate-600">{t.explorer.pick}</p>
			{/if}
			<p class="border-t border-slate-100 pt-3 text-xs text-slate-500">{t.explorer.method}</p>
		</aside>
	</div>
</div>
