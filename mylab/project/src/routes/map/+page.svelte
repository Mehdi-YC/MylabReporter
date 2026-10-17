<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate, messages } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const m = $derived(messages[data.locale]);
	const t = $derived(m.map);
	const fi = $derived(data.locale === 'fi');
	const areaName = (area: string) => t.areas[area] ?? area;
	const specimenName = (s: string) => m.specimens[s as 'urine'] ?? s;
	const num = (n: number) => n.toLocaleString(fi ? 'fi-FI' : 'en-GB');

	const submit = (e: Event) =>
		(e.currentTarget as HTMLSelectElement | HTMLInputElement).form?.requestSubmit();

	const isPct = $derived(data.indicator !== 'isolates');
	const abName = (code: string) => {
		const a = data.antibiotics.find((x) => x.code === code);
		return a ? (fi ? a.nameFi : a.name) : code;
	};
	const pct = (v: number | null, digits = 1) =>
		v === null ? '–' : `${fi ? v.toFixed(digits).replace('.', ',') : v.toFixed(digits)} %`;

	/** Sequential ramp, low (teal) → high (rose); same ramp for both maps. */
	const RAMP = ['#ccfbf1', '#5eead4', '#fde68a', '#fdba74', '#fb7185', '#be123c'];
	const ramp = (t: number) =>
		RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(t * RAMP.length)))];

	/** Round class width (1, 2, 2.5, 5 × 10^k) so the classes cover 0 → max in RAMP.length steps. */
	function niceStep(max: number): number {
		const raw = Math.max(max, 1e-9) / RAMP.length;
		const mag = 10 ** Math.floor(Math.log10(raw));
		return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
	}
	const stopsFor = (step: number) =>
		RAMP.map((color, i) => ({
			color,
			label: `${+(i * step).toFixed(1)}${i === RAMP.length - 1 ? '+' : ''}`
		}));

	// Regional map: classes adapt to the selection, from at least 0–12 % so that differences of
	// a few points (often within the confidence intervals) do not look alarming.
	const regionStep = $derived(
		niceStep(Math.max(isPct ? 12 : 6, ...data.areas.map((a) => (a.reliable ? (a.value ?? 0) : 0))))
	);
	const regionMax = $derived(regionStep * RAMP.length);
	const regionStops = $derived(stopsFor(regionStep));
	type Area = (typeof data.areas)[number];
	function areaFill(a: Area): string {
		if (a.value === null) return '#f1f5f9';
		if (!a.reliable) return 'url(#too-few)';
		return ramp(a.value / regionMax - 1e-9);
	}
	/** White labels on the two darkest classes. */
	const dark = (a: Area) =>
		a.value !== null && a.reliable && a.value / regionMax >= (RAMP.length - 2) / RAMP.length;
	const areaValue = (a: Area) =>
		a.value === null ? t.noIsolate : isPct ? pct(a.value) : t.isolatesN(a.value);

	// Stylised catchment around Tyks: Centre disc, four sectors (not real geography).
	const CX = 230;
	const CY = 215;
	const R0 = 72;
	const R1 = 190;
	function sector(start: number, end: number): string {
		const p = (r: number, deg: number) => {
			const rad = ((deg - 90) * Math.PI) / 180;
			return `${(CX + r * Math.cos(rad)).toFixed(1)},${(CY + r * Math.sin(rad)).toFixed(1)}`;
		};
		return `M${p(R0, start)} L${p(R1, start)} A${R1},${R1} 0 0 1 ${p(R1, end)} L${p(R0, end)} A${R0},${R0} 0 0 0 ${p(R0, start)} Z`;
	}
	const SECTORS: Record<string, { d: string; x: number; y: number }> = {
		North: { d: sector(-45, 45), x: CX, y: CY - 132 },
		East: { d: sector(45, 135), x: CX + 132, y: CY },
		South: { d: sector(135, 225), x: CX, y: CY + 132 },
		West: { d: sector(225, 315), x: CX - 132, y: CY }
	};
	const centre = $derived(data.areas.find((a) => a.area === 'Centre'));
	let hoverArea = $state<string | null>(null);
	const hovered = $derived(data.areas.find((a) => a.area === hoverArea) ?? null);

	const indicatorLabel = $derived(
		data.indicator === 'resistance'
			? t.indicatorResistance(data.filter.organism ?? '', abName(data.antibiotic))
			: data.indicator === 'esbl'
				? t.indicatorEsbl(data.filter.organism ?? '')
				: data.indicator === 'mrsa'
					? t.indicatorMrsa
					: t.indicatorIsolates(data.filter.organism ?? '')
	);

	// Europe choropleth.
	const eu = $derived(data.europe);
	const byId = $derived(new Map(eu.values.map((r) => [r.isoNumeric, r])));
	// Fixed classes for Europe (0, 5 … 25+ %), like ECDC's own maps.
	const EU_STEP = 5;
	const EU_MAX = EU_STEP * RAMP.length;
	const euStops = stopsFor(EU_STEP);
	const finland = $derived(eu.values.find((r) => r.iso3 === 'FIN'));
	const metaRaw = $derived(eu.indicators.find((i) => i.key === eu.indicator)!);
	const meta = $derived({ ...metaRaw, ...(t.ears[eu.indicator] ?? {}) });
	let tip = $state<{ id: string; name: string; x: number; y: number } | null>(null);
	const tipRow = $derived(tip ? byId.get(tip.id) : undefined);

	function moveTip(e: PointerEvent, id: string, name: string) {
		const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
		tip = { id, name, x: e.clientX - box.left, y: e.clientY - box.top };
	}
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
		<h2 class="font-semibold">{t.regional}</h2>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">{t.indicator}</span>
			<select name="indicator" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each data.indicators as ind (ind.key)}
					<option value={ind.key} selected={data.indicator === ind.key}
						>{t.indicators[ind.key] ?? ind.label}</option
					>
				{/each}
			</select>
		</label>
		{#if data.indicator === 'mrsa'}
			<input type="hidden" name="organism" value={data.filter.organism} />
		{:else}
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">{t.organism}</span>
				<select
					name="organism"
					class="w-full rounded-md border-slate-300 text-sm"
					onchange={submit}
				>
					{#each data.organisms as o (o)}
						<option value={o} selected={data.filter.organism === o}>{o}</option>
					{/each}
				</select>
			</label>
		{/if}
		{#if data.indicator === 'resistance'}
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">{t.antibiotic}</span>
				<select name="ab" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
					{#each data.antibiotics as a (a.code)}
						<option value={a.code} selected={data.antibiotic === a.code}
							>{fi ? a.nameFi : a.name}</option
						>
					{/each}
				</select>
			</label>
		{/if}
		<fieldset class="text-sm">
			<legend class="mb-1 font-medium text-slate-700">{t.period}</legend>
			<div class="flex gap-2">
				{#each [['4w', t.last4], ['12m', t.last12]] as [value, label] (value)}
					<label
						class={[
							'flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-center',
							data.period === value
								? 'border-teal-600 bg-teal-50 font-medium text-teal-800'
								: 'border-slate-300 text-slate-600'
						]}
					>
						<input
							type="radio"
							name="period"
							{value}
							checked={data.period === value}
							class="sr-only"
							onchange={submit}
						/>{label}
					</label>
				{/each}
			</div>
		</fieldset>
		<!-- Narrowing by ward, specimen or date is rarer: one tap away, values in the summary. -->
		<details class="rounded-md border border-slate-200 text-sm" open={!!data.filter.ward}>
			<summary
				class="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-slate-600 [&::-webkit-details-marker]:hidden"
			>
				<span
					><span class="font-medium text-slate-800">{t.more}</span> · {data.filter.ward ??
						t.allWards} · {data.filter.specimen
						? specimenName(data.filter.specimen)
						: t.allSpecimens} · {formatDate(data.locale, data.asOf)}</span
				><span aria-hidden="true" class="text-xs">▾</span>
			</summary>
			<div class="space-y-3 border-t border-slate-200 p-3">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-slate-700">{t.ward}</span>
					<select name="ward" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
						<option value="" selected={!data.filter.ward}>{t.allWardsOption}</option>
						{#each data.wards as w (w.code)}
							<option value={w.code} selected={data.filter.ward === w.code}
								>{w.code} · {fi ? w.nameFi : w.nameEn}</option
							>
						{/each}
					</select>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-slate-700">{t.specimen}</span>
					<select
						name="specimen"
						class="w-full rounded-md border-slate-300 text-sm"
						onchange={submit}
					>
						<option value="" selected={!data.filter.specimen}>{t.allSpecimensOption}</option>
						{#each ['urine', 'blood', 'wound'] as s (s)}
							<option value={s} selected={data.filter.specimen === s}>{specimenName(s)}</option>
						{/each}
					</select>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-slate-700">{t.date}</span>
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
			</div>
		</details>
		<h2 class="pt-2 font-semibold">{t.european}</h2>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">{t.earsIndicator}</span>
			<select name="eu" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each eu.indicators as ind (ind.key)}
					<option value={ind.key} selected={eu.indicator === ind.key}
						>{t.ears[ind.key]?.label ?? ind.label}</option
					>
				{/each}
			</select>
		</label>
		<noscript
			><button class="rounded-md bg-teal-700 px-3 py-2 text-white">{t.update}</button></noscript
		>
	</form>

	<div class="space-y-5">
		<section class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="font-semibold">{t.catchment} · {indicatorLabel}</h2>
				<span class="text-sm text-slate-500"
					>{formatDate(data.locale, data.window.from)} → {formatDate(data.locale, data.window.to)} · {t.firstIsolates}{data
						.filter.ward
						? ` · ${data.filter.ward}`
						: ''}{data.filter.specimen ? ` · ${specimenName(data.filter.specimen)}` : ''}</span
				>
			</div>
			<p class="mt-1 text-xs text-amber-800">{t.synthetic}</p>
			<a
				href="{resolve('/')}?{new URLSearchParams({
					view: 'organism',
					organism:
						data.indicator === 'mrsa'
							? 'Staphylococcus aureus'
							: (data.filter.organism ?? 'Escherichia coli'),
					specimen: data.filter.specimen ?? 'urine',
					window: data.period === '4w' ? '4w' : '12m',
					asOf: data.asOf,
					...(data.filter.ward ? { ward: data.filter.ward } : {})
				}).toString()}"
				class="mt-1 inline-block text-sm font-medium text-teal-700 hover:underline">{t.compare}</a
			>
			<div class="mt-3 grid items-center gap-4 md:grid-cols-[1fr_15rem]">
				<svg
					viewBox="0 0 460 430"
					class="w-full max-w-xl"
					role="img"
					aria-label={t.regionalAria(indicatorLabel)}
				>
					<defs>
						<pattern
							id="too-few"
							width="8"
							height="8"
							patternUnits="userSpaceOnUse"
							patternTransform="rotate(45)"
						>
							<rect width="8" height="8" fill="#f1f5f9" />
							<line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" stroke-width="3" />
						</pattern>
					</defs>
					{#each data.areas.filter((a) => SECTORS[a.area]) as a (a.area)}
						{@const s = SECTORS[a.area]}
						<path
							d={s.d}
							fill={areaFill(a)}
							stroke={hoverArea === a.area ? '#0f172a' : '#fff'}
							stroke-width={hoverArea === a.area ? 2.5 : 3}
							role="presentation"
							onpointerenter={() => (hoverArea = a.area)}
							onpointerleave={() => (hoverArea = null)}
						/>
						<text
							x={s.x}
							y={s.y - 6}
							text-anchor="middle"
							class={['text-[13px] font-semibold', dark(a) ? 'fill-white' : 'fill-slate-800']}
							>{areaName(a.area)}</text
						>
						<text
							x={s.x}
							y={s.y + 12}
							text-anchor="middle"
							class={['text-[12px]', dark(a) ? 'fill-white' : 'fill-slate-700']}
							>{areaValue(a)}</text
						>
						<text
							x={s.x}
							y={s.y + 27}
							text-anchor="middle"
							class={['text-[10px]', dark(a) ? 'fill-white' : 'fill-slate-500']}
							>n = {a.share?.n ?? a.isolates}</text
						>
					{/each}
					{#if centre}
						<circle
							cx={CX}
							cy={CY}
							r={R0 - 2}
							fill={areaFill(centre)}
							stroke={hoverArea === 'Centre' ? '#0f172a' : '#fff'}
							stroke-width="3"
							role="presentation"
							onpointerenter={() => (hoverArea = 'Centre')}
							onpointerleave={() => (hoverArea = null)}
						/>
						<text
							x={CX}
							y={CY - 22}
							text-anchor="middle"
							class={['text-[13px] font-semibold', dark(centre) ? 'fill-white' : 'fill-slate-800']}
							>{areaName('Centre')}</text
						>
						<text
							x={CX}
							y={CY - 5}
							text-anchor="middle"
							class={['text-[12px]', dark(centre) ? 'fill-white' : 'fill-slate-700']}
							>{areaValue(centre)}</text
						>
						<text
							x={CX}
							y={CY + 10}
							text-anchor="middle"
							class={['text-[10px]', dark(centre) ? 'fill-white' : 'fill-slate-500']}
							>n = {centre.share?.n ?? centre.isolates}</text
						>
						<g class="pointer-events-none">
							<rect x={CX - 26} y={CY + 20} width="52" height="18" rx="4" fill="#0f766e" />
							<text
								x={CX}
								y={CY + 33}
								text-anchor="middle"
								class="fill-white text-[10px] font-semibold">✚ Tyks</text
							>
						</g>
					{/if}
				</svg>
				<div class="space-y-3 text-sm">
					<div>
						<div class="mb-1 text-xs font-medium text-slate-600">
							{isPct ? t.classesAdapt : t.colFirst}
						</div>
						<div class="flex">
							{#each regionStops as stop (stop.color)}
								<div class="flex-1">
									<div class="h-3" style:background={stop.color}></div>
									<div class="mt-0.5 text-[10px] text-slate-500">{stop.label}</div>
								</div>
							{/each}
						</div>
						{#if isPct}
							<div class="mt-2 flex items-center gap-2 text-xs text-slate-500">
								<svg width="18" height="12" aria-hidden="true"
									><rect width="18" height="12" fill="url(#too-few)" stroke="#cbd5e1" /></svg
								>
								{t.tooFewLegend}
							</div>
						{/if}
					</div>
					<div class="rounded-lg bg-slate-50 p-3">
						{#if hovered}
							<div class="font-semibold">{areaName(hovered.area)}</div>
							<div>{areaValue(hovered)}</div>
							{#if hovered.share && hovered.share.low !== null && hovered.share.high !== null}
								<div class="text-xs text-slate-500">
									{t.ci}
									{pct(hovered.share.low * 100)} – {pct(hovered.share.high * 100)} ·
									{hovered.share.k}/{hovered.share.n}
								</div>
							{/if}
							{#if isPct && !hovered.reliable}
								<div class="text-xs text-amber-700">{t.tooFewHover}</div>
							{/if}
						{:else if data.all}
							<div class="text-xs text-slate-500">{t.allAreas}</div>
							<div class="font-semibold">
								{data.all.value === null
									? '–'
									: isPct
										? pct(data.all.value)
										: t.isolatesN(data.all.value)}
							</div>
							<div class="text-xs text-slate-500">
								n = {data.all.share?.n ?? data.all.isolates} · {t.hoverHint}
							</div>
						{/if}
					</div>
				</div>
			</div>
			<table class="mt-3 w-full text-left text-sm">
				<thead class="text-xs text-slate-500">
					<tr>
						<th class="py-1 font-medium">{t.colArea}</th>
						<th class="py-1 text-right font-medium">{t.colFirst}</th>
						{#if isPct}
							<th class="py-1 text-right font-medium">{t.colTested}</th>
							<th class="py-1 text-right font-medium">{t.colValue}</th>
							<th class="py-1 text-right font-medium">{t.ci}</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.areas as a (a.area)}
						<tr class={['border-t border-slate-100', isPct && !a.reliable && 'text-slate-400']}>
							<td class="py-1">{areaName(a.area)}</td>
							<td class="py-1 text-right tabular-nums">{a.isolates}</td>
							{#if isPct}
								<td class="py-1 text-right tabular-nums">{a.share?.n ?? 0}</td>
								<td class="py-1 text-right tabular-nums">{pct(a.value)}</td>
								<td class="py-1 text-right text-xs tabular-nums">
									{a.share?.low != null && a.share.high != null
										? `${(a.share.low * 100).toFixed(0)}–${(a.share.high * 100).toFixed(0)} %`
										: '–'}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="font-semibold">{t.europe} · {meta.label}</h2>
				<span class="text-sm text-slate-500"
					>EARS-Net {eu.values[0]?.year ?? ''} · {t.invasive}</span
				>
			</div>
			<p class="mt-1 text-xs text-slate-500">{meta.description}.</p>
			<div class="mt-3 grid gap-4 xl:grid-cols-[1fr_16rem]">
				<div class="relative">
					<svg
						viewBox="0 0 {eu.width} {eu.height}"
						class="w-full rounded-lg bg-sky-50"
						role="img"
						aria-label={t.europeAria(meta.label)}
						onpointerleave={() => (tip = null)}
					>
						{#each eu.shapes as c (c.id + c.name)}
							{@const row = byId.get(c.id)}
							<path
								d={c.d}
								fill={row ? ramp(row.percent / EU_MAX - 1e-9) : '#e2e8f0'}
								stroke="#fff"
								stroke-width="0.6"
								role="presentation"
								onpointermove={(e) => moveTip(e, c.id, c.name)}
							/>
						{/each}
						{#each eu.shapes.filter((c) => c.id === '246') as c (c.id)}
							<path
								d={c.d}
								fill="none"
								stroke="#0f172a"
								stroke-width="2"
								class="pointer-events-none"
							/>
						{/each}
					</svg>
					{#if tip}
						<div
							class="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow"
							style:left="{tip.x + 12}px"
							style:top="{tip.y + 12}px"
						>
							<div class="font-semibold">{tip.name}</div>
							{#if tipRow}
								<div>{pct(tipRow.percent)} · n = {num(tipRow.isolates)}</div>
								<div class="text-slate-500">EARS-Net {tipRow.year}</div>
							{:else}
								<div class="text-slate-500">{t.noData}</div>
							{/if}
						</div>
					{/if}
				</div>
				<div class="space-y-3 text-sm">
					<div>
						<div class="mb-1 text-xs font-medium text-slate-600">{t.pctResistant}</div>
						<div class="flex">
							{#each euStops as stop (stop.color)}
								<div class="flex-1">
									<div class="h-3" style:background={stop.color}></div>
									<div class="mt-0.5 text-[10px] text-slate-500">{stop.label}</div>
								</div>
							{/each}
						</div>
						<div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
							<span class="inline-block h-3 w-4 bg-slate-200"></span>
							{t.outside}
						</div>
					</div>
					<div class="rounded-lg border border-teal-200 bg-teal-50 p-3">
						<div class="text-xs font-medium tracking-wide text-teal-900 uppercase">
							{t.vsFinland}
						</div>
						<div class="mt-2 flex items-baseline justify-between">
							<span>{t.thisDataset}</span>
							<span class="text-lg font-semibold tabular-nums"
								>{pct(eu.dataset.p === null ? null : eu.dataset.p * 100)}</span
							>
						</div>
						<div class="text-xs text-slate-600">
							{t.datasetLine(
								eu.dataset.k,
								eu.dataset.n,
								formatDate(data.locale, eu.datasetWindow.from),
								formatDate(data.locale, eu.datasetWindow.to)
							)}{eu.dataset.low !== null && eu.dataset.high !== null
								? ` · ${t.ci} ${pct(eu.dataset.low * 100)}–${pct(eu.dataset.high * 100)}`
								: ''}
						</div>
						{#if finland}
							<div class="mt-2 flex items-baseline justify-between">
								<span>{t.finland}</span>
								<span class="text-lg font-semibold tabular-nums">{pct(finland.percent)}</span>
							</div>
							<div class="text-xs text-slate-600">
								EARS-Net {finland.year}, n = {num(finland.isolates)}
							</div>
							<div class="mt-2 flex items-baseline justify-between text-slate-600">
								<span>{t.euMean}</span>
								<span class="tabular-nums">{pct(finland.euMean)}</span>
							</div>
						{/if}
						<p class="mt-2 text-xs text-slate-500">
							{eu.indicator === 'saureus_mrsa' ? t.datasetMrsa : t.datasetEcoli}
							{t.syntheticNote}
						</p>
					</div>
				</div>
			</div>
			<p class="mt-3 text-xs text-slate-500">
				{t.source}: {eu.values[0]?.source ?? 'data/ears-net.csv'}, {t.via}
				<a
					href="https://www.ecdc.europa.eu/en/about-us/networks/disease-networks-and-laboratory-networks/ears-net-data"
					class="text-teal-700 underline"
					rel="external noopener"
					target="_blank">ECDC EARS-Net</a
				>. {t.shipped} <code>data/ears-net.csv</code>. {t.liechtenstein}
			</p>
		</section>
	</div>
</div>
