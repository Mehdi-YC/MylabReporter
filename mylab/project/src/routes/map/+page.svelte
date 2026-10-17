<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const submit = (e: Event) =>
		(e.currentTarget as HTMLSelectElement | HTMLInputElement).form?.requestSubmit();

	const isPct = $derived(data.indicator !== 'isolates');
	const abName = (code: string) => data.antibiotics.find((a) => a.code === code)?.name ?? code;
	const pct = (v: number | null, digits = 1) => (v === null ? '–' : `${v.toFixed(digits)} %`);

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
		a.value === null ? 'no isolate' : isPct ? pct(a.value) : `${a.value} isolates`;

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
			? `% of ${data.filter.organism} resistant to ${abName(data.antibiotic)}`
			: data.indicator === 'esbl'
				? `% ESBL among ${data.filter.organism}`
				: data.indicator === 'mrsa'
					? '% MRSA among S. aureus'
					: `First isolates of ${data.filter.organism}`
	);

	// Europe choropleth.
	const eu = $derived(data.europe);
	const byId = $derived(new Map(eu.values.map((r) => [r.isoNumeric, r])));
	// Fixed classes for Europe (0, 5 … 25+ %), like ECDC's own maps.
	const EU_STEP = 5;
	const EU_MAX = EU_STEP * RAMP.length;
	const euStops = stopsFor(EU_STEP);
	const finland = $derived(eu.values.find((r) => r.iso3 === 'FIN'));
	const meta = $derived(eu.indicators.find((i) => i.key === eu.indicator)!);
	let tip = $state<{ id: string; name: string; x: number; y: number } | null>(null);
	const tipRow = $derived(tip ? byId.get(tip.id) : undefined);

	function moveTip(e: PointerEvent, id: string, name: string) {
		const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
		tip = { id, name, x: e.clientX - box.left, y: e.clientY - box.top };
	}
</script>

<section class="mb-5">
	<h1 class="text-2xl font-semibold tracking-tight">Resistance map</h1>
	<p class="mt-1 max-w-3xl text-slate-600">
		Where resistance comes from in the hospital's catchment, and how the hospital compares with
		Europe. The regional view uses the patients' home areas in the laboratory extract; the European
		view uses national EARS-Net figures published by ECDC.
	</p>
</section>

<div class="grid gap-5 lg:grid-cols-[18rem_1fr]">
	<form
		method="GET"
		class="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4"
	>
		<h2 class="font-semibold">Regional view</h2>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Indicator</span>
			<select name="indicator" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each data.indicators as ind (ind.key)}
					<option value={ind.key} selected={data.indicator === ind.key}>{ind.label}</option>
				{/each}
			</select>
		</label>
		{#if data.indicator === 'mrsa'}
			<input type="hidden" name="organism" value={data.filter.organism} />
		{:else}
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">Organism</span>
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
				<span class="mb-1 block font-medium text-slate-700">Antibiotic</span>
				<select name="ab" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
					{#each data.antibiotics as a (a.code)}
						<option value={a.code} selected={data.antibiotic === a.code}>{a.name}</option>
					{/each}
				</select>
			</label>
		{/if}
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Ward</span>
			<select name="ward" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				<option value="" selected={!data.filter.ward}>All wards</option>
				{#each data.wards as w (w.code)}
					<option value={w.code} selected={data.filter.ward === w.code}
						>{w.code} · {w.nameEn}</option
					>
				{/each}
			</select>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Specimen</span>
			<select name="specimen" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				<option value="" selected={!data.filter.specimen}>All specimens</option>
				{#each ['urine', 'blood', 'wound'] as s (s)}
					<option value={s} selected={data.filter.specimen === s}>{s}</option>
				{/each}
			</select>
		</label>
		<fieldset class="text-sm">
			<legend class="mb-1 font-medium text-slate-700">Period</legend>
			<div class="flex gap-2">
				{#each [['4w', 'Last 4 weeks'], ['12m', 'Last 12 months']] as [value, label] (value)}
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
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Date</span>
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
		<h2 class="pt-2 font-semibold">European view</h2>
		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">EARS-Net indicator</span>
			<select name="eu" class="w-full rounded-md border-slate-300 text-sm" onchange={submit}>
				{#each eu.indicators as ind (ind.key)}
					<option value={ind.key} selected={eu.indicator === ind.key}>{ind.label}</option>
				{/each}
			</select>
		</label>
		<noscript><button class="rounded-md bg-teal-700 px-3 py-2 text-white">Update</button></noscript>
	</form>

	<div class="space-y-5">
		<section class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="font-semibold">Catchment areas · {indicatorLabel}</h2>
				<span class="text-sm text-slate-500"
					>{data.window.from} → {data.window.to} · first isolates{data.filter.ward
						? ` · ${data.filter.ward}`
						: ''}{data.filter.specimen ? ` · ${data.filter.specimen}` : ''}</span
				>
			</div>
			<p class="mt-1 text-xs text-amber-800">
				Synthetic areas: the extract only gives five abstract home areas around Tyks (Turku). The
				layout below is schematic, not real municipal borders.
			</p>
			<div class="mt-3 grid items-center gap-4 md:grid-cols-[1fr_15rem]">
				<svg
					viewBox="0 0 460 430"
					class="w-full max-w-xl"
					role="img"
					aria-label="Regional map of {indicatorLabel}"
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
							>{a.area}</text
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
							>Centre</text
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
							{isPct ? '% (classes adapt to the selection)' : 'First isolates'}
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
								fewer than 30 isolates: not reported
							</div>
						{/if}
					</div>
					<div class="rounded-lg bg-slate-50 p-3">
						{#if hovered}
							<div class="font-semibold">{hovered.area}</div>
							<div>{areaValue(hovered)}</div>
							{#if hovered.share && hovered.share.low !== null && hovered.share.high !== null}
								<div class="text-xs text-slate-500">
									95 % CI {pct(hovered.share.low * 100)} – {pct(hovered.share.high * 100)} ·
									{hovered.share.k}/{hovered.share.n}
								</div>
							{/if}
							{#if isPct && !hovered.reliable}
								<div class="text-xs text-amber-700">Fewer than 30 isolates: indicative only.</div>
							{/if}
						{:else if data.all}
							<div class="text-xs text-slate-500">All areas</div>
							<div class="font-semibold">
								{data.all.value === null
									? '–'
									: isPct
										? pct(data.all.value)
										: `${data.all.value} isolates`}
							</div>
							<div class="text-xs text-slate-500">
								n = {data.all.share?.n ?? data.all.isolates} · hover an area for details
							</div>
						{/if}
					</div>
				</div>
			</div>
			<table class="mt-3 w-full text-left text-sm">
				<thead class="text-xs text-slate-500">
					<tr>
						<th class="py-1 font-medium">Area</th>
						<th class="py-1 text-right font-medium">First isolates</th>
						{#if isPct}
							<th class="py-1 text-right font-medium">Tested</th>
							<th class="py-1 text-right font-medium">Value</th>
							<th class="py-1 text-right font-medium">95 % CI</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.areas as a (a.area)}
						<tr class={['border-t border-slate-100', isPct && !a.reliable && 'text-slate-400']}>
							<td class="py-1">{a.area}</td>
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
				<h2 class="font-semibold">Europe · {meta.label}</h2>
				<span class="text-sm text-slate-500"
					>EARS-Net {eu.values[0]?.year ?? ''} · invasive isolates</span
				>
			</div>
			<p class="mt-1 text-xs text-slate-500">{meta.description}.</p>
			<div class="mt-3 grid gap-4 xl:grid-cols-[1fr_16rem]">
				<div class="relative">
					<svg
						viewBox="0 0 {eu.width} {eu.height}"
						class="w-full rounded-lg bg-sky-50"
						role="img"
						aria-label="Map of Europe: {meta.label}"
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
								<div>{pct(tipRow.percent)} · n = {tipRow.isolates.toLocaleString('en')}</div>
								<div class="text-slate-500">EARS-Net {tipRow.year}</div>
							{:else}
								<div class="text-slate-500">Not in EARS-Net / no data</div>
							{/if}
						</div>
					{/if}
				</div>
				<div class="space-y-3 text-sm">
					<div>
						<div class="mb-1 text-xs font-medium text-slate-600">% resistant</div>
						<div class="flex">
							{#each euStops as stop (stop.color)}
								<div class="flex-1">
									<div class="h-3" style:background={stop.color}></div>
									<div class="mt-0.5 text-[10px] text-slate-500">{stop.label}</div>
								</div>
							{/each}
						</div>
						<div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
							<span class="inline-block h-3 w-4 bg-slate-200"></span> outside EARS-Net / no data
						</div>
					</div>
					<div class="rounded-lg border border-teal-200 bg-teal-50 p-3">
						<div class="text-xs font-medium tracking-wide text-teal-900 uppercase">
							Tyks extract vs Finland
						</div>
						<div class="mt-2 flex items-baseline justify-between">
							<span>This dataset</span>
							<span class="text-lg font-semibold tabular-nums"
								>{pct(eu.dataset.p === null ? null : eu.dataset.p * 100)}</span
							>
						</div>
						<div class="text-xs text-slate-600">
							{eu.dataset.k}/{eu.dataset.n} first blood isolates, {eu.datasetWindow.from} → {eu
								.datasetWindow.to}{eu.dataset.low !== null && eu.dataset.high !== null
								? ` · 95 % CI ${(eu.dataset.low * 100).toFixed(1)}–${(eu.dataset.high * 100).toFixed(1)} %`
								: ''}
						</div>
						{#if finland}
							<div class="mt-2 flex items-baseline justify-between">
								<span>Finland (national)</span>
								<span class="text-lg font-semibold tabular-nums">{pct(finland.percent)}</span>
							</div>
							<div class="text-xs text-slate-600">
								EARS-Net {finland.year}, n = {finland.isolates.toLocaleString('en')}
							</div>
							<div class="mt-2 flex items-baseline justify-between text-slate-600">
								<span>EU/EEA mean</span>
								<span class="tabular-nums">{pct(finland.euMean)}</span>
							</div>
						{/if}
						<p class="mt-2 text-xs text-slate-500">
							{eu.indicator === 'saureus_mrsa'
								? 'Dataset: MRSA flag among S. aureus from blood cultures.'
								: 'Dataset: ceftriaxone-resistant E. coli from blood cultures (EARS-Net counts any of cefotaxime, ceftriaxone or ceftazidime).'}
							The extract is synthetic: the comparison shows the method, not Tyks' real level.
						</p>
					</div>
				</div>
			</div>
			<p class="mt-3 text-xs text-slate-500">
				Source: {eu.values[0]?.source ?? 'data/ears-net.csv'}, via
				<a
					href="https://www.ecdc.europa.eu/en/about-us/networks/disease-networks-and-laboratory-networks/ears-net-data"
					class="text-teal-700 underline"
					rel="external noopener"
					target="_blank">ECDC EARS-Net</a
				>. Values are shipped in <code>data/ears-net.csv</code>. Liechtenstein reported too few
				isolates.
			</p>
		</section>
	</div>
</div>
