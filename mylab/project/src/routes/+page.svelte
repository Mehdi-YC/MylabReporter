<script lang="ts">
	import { resolve } from '$app/paths';
	import { alertReasons, alertTitle } from '#lib/alertText.ts';
	import { askAei } from '#lib/askBus.ts';
	import { formatDate, formatPercent, formatRange, messages } from '#lib/i18n.ts';
	import type { Proportion } from '#lib/amr/stats.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const t = $derived(messages[data.locale]);
	const fi = $derived(data.locale === 'fi');
	const pct = (x: number | null) => formatPercent(data.locale, x);
	const pctP = (p: number | null) => formatPercent(data.locale, p === null ? null : p * 100);
	const wardName = (code: string) => {
		const w = data.wards.find((x) => x.code === code);
		return w ? (fi ? w.nameFi : w.nameEn) : code;
	};
	const abName = (code: string) => {
		const a = data.antibiotics.find((x) => x.code === code);
		return a ? (fi ? a.nameFi : a.name) : code;
	};
	const w4 = $derived(data.input.window === '4w');
	const latest = $derived(data.asOf === data.range.last);
	/** "Escherichia coli" → "E. coli", for the narrow first column on phones. */
	const shortName = (organism: string) => organism.replace(/^(\p{L})\p{L}+ /u, '$1. ');
	let dateOpen = $state(false);
	const submit = (e: Event) => {
		dateOpen = false;
		(e.currentTarget as HTMLSelectElement | HTMLInputElement).form?.requestSubmit();
	};

	/** Current selection plus overrides, as a query string for links. */
	function q(over: Record<string, string | null> = {}): string {
		const base: Record<string, string | null> = {
			ward: data.input.ward,
			specimen: data.input.specimen,
			window: data.input.windowAuto ? null : data.input.window,
			view: data.input.view,
			organism: data.input.view === 'organism' ? data.input.organism : null,
			asOf: data.asOf,
			cellOrg: data.cell?.organism ?? null,
			cellAb: data.cell?.code ?? null,
			...over
		};
		return new URLSearchParams(
			Object.entries(base).filter((e): e is [string, string] => !!e[1])
		).toString();
	}

	const tint = (s: Proportion) => {
		if (!s.reliable || s.p === null) return 'bg-slate-100 text-slate-400';
		if (s.p >= 0.25) return 'bg-rose-50 text-rose-700';
		if (s.p >= 0.1) return 'bg-amber-50 text-slate-900';
		return 'bg-white text-slate-900';
	};

	// 24-month chart (600 wide, plus room for a 3-month projection): this ward and all wards.
	const chartMax = $derived(
		Math.max(
			30,
			...(data.cell?.ward.map((p) => p.r ?? 0) ?? []),
			...(data.cell?.hospital.map((p) => p.r ?? 0) ?? []),
			data.cell?.outlook?.projected ?? 0
		)
	);
	const chartWidth = $derived(600 + (3 * 600) / Math.max(1, (data.cell?.ward.length ?? 2) - 1));
	// Fitted line over the complete months and its projection (the outlook leaves the current,
	// partial month out, so its last fitted point is the month before).
	const fit = $derived.by(() => {
		const c = data.cell;
		const o = c?.outlook;
		if (!c || !o || o.trend === 'stable') return null;
		const n = c.ward.length;
		const last = n - 2;
		const at = (j: number) => Math.min(100, Math.max(0, o.current + o.slope * (j - last)));
		const pt = (j: number) => `${cx(j, n).toFixed(1)},${cy(at(j)).toFixed(1)}`;
		return { past: `${pt(0)} ${pt(last)}`, ahead: `${pt(last)} ${pt(last + o.horizon)}` };
	});
	const cx = (i: number, n: number) => (i * 600) / Math.max(1, n - 1);
	const cy = (v: number) => 150 - (v / chartMax) * 130;
	const line = (points: { r: number | null }[]) =>
		points
			.map((p, i) =>
				p.r === null ? null : `${cx(i, points.length).toFixed(1)},${cy(p.r).toFixed(1)}`
			)
			.filter(Boolean)
			.join(' ');
	const monthLabel = (m: string) =>
		fi
			? `${Number(m.slice(5))}/${m.slice(0, 4)}`
			: new Date(`${m}-01T00:00:00Z`).toLocaleString('en-GB', {
					month: 'short',
					year: 'numeric',
					timeZone: 'UTC'
				});

	const LEVEL = {
		critical: 'border-rose-300 bg-rose-50 text-rose-700',
		warning: 'border-amber-300 bg-amber-50 text-amber-800',
		sentinel: 'border-rose-300 bg-rose-50 text-rose-700'
	};
</script>

<form
	method="GET"
	class="-mx-4 -mt-6 mb-6 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:sticky sm:top-0 sm:z-30 sm:-mx-8 sm:px-8"
>
	<!-- Three plain choices: which ward, which specimen, and (rarely) an earlier date. -->
	<input type="hidden" name="view" value={data.input.view} />
	{#if !data.input.windowAuto}<input type="hidden" name="window" value={data.input.window} />{/if}
	{#if data.input.view === 'organism'}<input
			type="hidden"
			name="organism"
			value={data.input.organism}
		/>{/if}
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
		<label class="sr-only" for="ward-filter">{t.ward}</label>
		<select
			id="ward-filter"
			name="ward"
			class="min-h-11 w-full min-w-0 rounded-md border-slate-300 text-base font-semibold text-slate-900 sm:w-auto sm:text-[15px]"
			onchange={submit}
		>
			{#each data.wards as w (w.code)}
				<option value={w.code} selected={data.input.ward === w.code}
					>{fi ? w.nameFi : w.nameEn} ({w.code})</option
				>
			{/each}
		</select>
		<fieldset class="min-w-0">
			<legend class="sr-only">{t.specimen}</legend>
			<div class="flex rounded-lg bg-slate-100 p-0.5">
				{#each ['urine', 'blood', 'wound'] as const as s (s)}
					<label
						class={[
							'flex min-h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-teal-600',
							data.input.specimen === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
						]}
					>
						<input
							type="radio"
							name="specimen"
							value={s}
							checked={data.input.specimen === s}
							class="sr-only"
							onchange={submit}
						/>{t.specimens[s]}
					</label>
				{/each}
			</div>
		</fieldset>
		<details class="relative" bind:open={dateOpen}>
			<summary
				class={[
					'flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-sm font-medium [&::-webkit-details-marker]:hidden',
					latest
						? 'border-slate-300 bg-white text-slate-700'
						: 'border-amber-300 bg-amber-50 text-amber-900'
				]}
			>
				<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"
					><rect
						x="2"
						y="3"
						width="12"
						height="11"
						rx="1.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
					/><path
						d="M2 6.5 H14 M5 1.5 V4 M11 1.5 V4"
						stroke="currentColor"
						stroke-width="1.4"
					/></svg
				>
				{latest ? t.filters.latest : t.filters.viewing(formatDate(data.locale, data.asOf))}
				<span aria-hidden="true" class="text-xs">▾</span>
			</summary>
			<div
				class="absolute left-0 z-40 mt-2 flex w-[min(18rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
			>
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
					{t.filters.dateHelp}
					<input
						type="date"
						name="asOf"
						value={data.asOf}
						min={data.range.first}
						max={data.range.last}
						class="min-h-10 rounded-md border-slate-300 text-base text-slate-900 sm:text-sm"
						onchange={submit}
					/>
				</label>
				{#if !latest}
					<a
						href="{resolve('/')}?{q({ asOf: null })}"
						class="text-sm font-semibold text-teal-700 hover:underline"
						>{t.filters.backToLatest} →</a
					>
				{/if}
			</div>
		</details>
		<noscript
			><button class="min-h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
				>{t.update}</button
			></noscript
		>
		<div class="hidden flex-1 sm:block"></div>
		<a
			href="{resolve('/station')}?{new URLSearchParams({
				ward: data.input.ward,
				asOf: data.asOf
			}).toString()}"
			class="hidden text-sm font-medium text-teal-700 hover:underline sm:inline"
			>{t.nav.station} →</a
		>
	</div>
</form>

<div class="flex flex-col gap-7">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<div>
			<h1 class="text-[28px] font-semibold tracking-tight">{wardName(data.input.ward)}</h1>
			<p class="mt-1 text-sm text-slate-600">
				{t.pulse.subtitle(t.specimens[data.input.specimen])}
			</p>
		</div>
		<p class="text-sm text-slate-500">
			{t.pulse.windows(
				formatRange(data.locale, data.windows.recent),
				formatRange(data.locale, data.windows.annual)
			)}
		</p>
	</div>

	<!-- The three questions a clinician asks, in plain sentences. -->
	<div class="grid gap-4 lg:grid-cols-3">
		<section
			aria-labelledby="status"
			class={[
				'flex flex-col gap-2.5 rounded-xl border bg-white p-5',
				data.primary
					? data.primary.severity === 'critical'
						? 'border-rose-300'
						: 'border-amber-300'
					: 'border-emerald-200'
			]}
		>
			<h2 id="status" class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
				{t.pulse.statusTitle}
			</h2>
			{#if data.primary}
				{@const p = data.primary}
				<span
					class={[
						'w-fit rounded px-2 py-0.5 text-xs font-semibold',
						p.severity === 'critical' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
					]}>{p.severity === 'critical' ? t.critical : t.warning}</span
				>
				<p class="text-[17px] leading-snug font-semibold">
					{alertTitle(
						data.locale,
						{ ...p, ward: data.input.ward },
						wardName(data.input.ward),
						p.antibiotic ? abName(p.antibiotic) : undefined
					)}
				</p>
				<p class="text-sm text-slate-600">
					{alertReasons(data.locale, { ...p, ward: data.input.ward })[0]}
				</p>
				{#if data.wardAlerts.total > 1}<p class="text-sm text-slate-500">
						{t.pulse.moreAlerts(data.wardAlerts.total - 1)}
					</p>{/if}
				<div class="flex-1"></div>
				<a
					href="{resolve('/alerts')}?asOf={data.asOf}"
					class="text-sm font-semibold text-teal-700 hover:underline">{t.pulse.openAnomaly} →</a
				>
			{:else}
				<p class="flex items-center gap-2 text-[17px] font-semibold text-emerald-700">
					<svg width="22" height="22" viewBox="0 0 56 56" aria-hidden="true"
						><circle cx="28" cy="28" r="26" fill="#E3F0E7" /><path
							d="M18 28.5 L25 35 L38.5 21"
							fill="none"
							stroke="#2E6B45"
							stroke-width="4"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
					{t.noDeviations}
				</p>
				<p class="text-sm text-slate-600">{t.pulse.calm}</p>
			{/if}
		</section>

		<section
			aria-labelledby="give"
			class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5"
		>
			<h2 id="give" class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
				{t.pulse.giveTitle}
			</h2>
			{#each data.empiric as e (e.site)}
				<a
					href="{resolve('/advisor')}?{new URLSearchParams({
						ward: data.input.ward,
						site: e.site,
						asOf: data.asOf
					}).toString()}"
					class="flex items-baseline justify-between gap-3 rounded-md py-1.5 hover:bg-slate-50"
				>
					<span>
						<span class="block text-sm text-slate-500">{t.pulse.empiricSites[e.key]}</span>
						<span class="block text-[17px] font-semibold">{e.code ? abName(e.code) : '–'}</span>
						{#if !e.adequate}<span class="block text-xs text-amber-800">{t.pulse.noAdequate}</span
							>{/if}
						{#if e.reserve}<span class="mt-0.5 block text-xs text-rose-700"
								>{t.pulse.reserveSevere(abName(e.reserve.code), pct(e.reserve.coverage))}</span
							>{/if}
					</span>
					<span
						class={['text-lg font-semibold', e.adequate ? 'text-emerald-700' : 'text-amber-800']}
						>{pct(e.coverage)}</span
					>
				</a>
			{/each}
			{#if data.warned.length}
				<p class="mt-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
					{t.pulse.avoid(data.warned.map((c) => abName(c)).join(', '))}
				</p>
			{/if}
			<p class="text-xs text-slate-500">{t.decisionSupport}</p>
		</section>

		<section
			aria-labelledby="changes"
			class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5"
		>
			<h2 id="changes" class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
				{t.pulse.changesTitle}
			</h2>
			{#each data.changes as c (c.organism + c.code)}
				<div class="flex items-start gap-2 border-b border-slate-100 py-2 last:border-0">
					<a
						href="{resolve('/')}?{q({
							view: 'ward',
							organism: null,
							cellOrg: c.organism,
							cellAb: c.code
						})}#detail"
						class="min-w-0 flex-1 rounded-md hover:bg-slate-50"
					>
						<span class="block text-sm text-slate-600 italic">{c.organism}</span>
						<span class="block font-semibold"
							>{t.pulse.changeLine(abName(c.code), pct(c.recent), pct(c.annual))}</span
						>
					</a>
					<button
						type="button"
						class="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50"
						onclick={() =>
							askAei(t.chat.askAbout(c.organism, abName(c.code), wardName(data.input.ward)))}
						>{t.chat.ask}</button
					>
				</div>
			{:else}
				<p class="text-sm text-slate-600">{t.pulse.noChanges}</p>
			{/each}
			{#if data.early.length}
				<h3
					class="mt-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase"
				>
					<span aria-hidden="true">↗</span>{t.forecast.changesTitle}
				</h3>
				{#each data.early as e (e.organism + e.code)}
					<a
						href="{resolve('/')}?{q({
							view: 'ward',
							organism: null,
							cellOrg: e.organism,
							cellAb: e.code
						})}#detail"
						class="rounded-md py-1 hover:bg-slate-50"
					>
						<span class="block text-sm text-slate-600 italic">{e.organism}</span>
						<span class="block text-sm font-semibold"
							>{t.forecast.line(abName(e.code), pct(e.current), String(e.slope))}</span
						>
						{#if e.warning && e.monthsToThreshold !== null}<span
								class="block text-xs text-amber-800"
								>{t.forecast.reach(t.forecast.months(e.monthsToThreshold))}</span
							>{/if}
					</a>
				{/each}
			{/if}
		</section>
	</div>

	<section aria-labelledby="table-title">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<h2 id="table-title" class="text-[17px] font-semibold">
				{data.input.view === 'organism'
					? t.pulse.tableByOrganism(data.input.organism)
					: t.pulse.tableByWard(wardName(data.input.ward))}
				<span class="ml-1 text-sm font-normal text-slate-500">· {w4 ? t.w4 : t.w12}</span
				>{#if data.input.windowAuto && !w4}<span class="ml-1 text-sm font-normal text-slate-500"
						>({t.filters.autoWindow})</span
					>{/if}
			</h2>
			<div class="flex flex-wrap items-center gap-3">
				<nav aria-label={t.window} class="flex rounded-lg bg-slate-100 p-0.5 text-sm font-medium">
					{#each [['4w', t.w4], ['12m', t.w12]] as [value, label] (value)}
						<a
							href="{resolve('/')}?{q({ window: value })}"
							aria-current={data.input.window === value ? 'true' : undefined}
							data-sveltekit-reset="false"
							class={[
								'flex min-h-9 items-center rounded-md px-3',
								data.input.window === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
							]}>{label}</a
						>
					{/each}
				</nav>
				{#if data.input.view === 'organism'}
					<form method="GET" class="flex items-center gap-2">
						{#each Object.entries( { ward: data.input.ward, specimen: data.input.specimen, window: data.input.window, view: 'organism', asOf: data.asOf } ) as [name, value] (name)}
							<input type="hidden" {name} {value} />
						{/each}
						<label class="sr-only" for="organism">{t.organism}</label>
						<select
							id="organism"
							name="organism"
							class="min-h-9 rounded-md border-slate-300 text-sm italic"
							onchange={submit}
						>
							{#each data.organisms as o (o)}
								<option value={o} selected={data.input.organism === o}>{o}</option>
							{/each}
						</select>
					</form>
				{/if}
				<nav
					aria-label={t.pulse.viewLabel}
					class="flex rounded-lg bg-slate-100 p-0.5 text-sm font-medium"
				>
					<a
						href="{resolve('/')}?{q({ view: 'ward', organism: null })}"
						aria-current={data.input.view === 'ward' ? 'true' : undefined}
						class={[
							'flex min-h-9 items-center rounded-md px-3',
							data.input.view === 'ward' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
						]}>{t.pulse.viewWard}</a
					>
					<a
						href="{resolve('/')}?{q({ view: 'organism', organism: data.input.organism })}"
						aria-current={data.input.view === 'organism' ? 'true' : undefined}
						class={[
							'flex min-h-9 items-center rounded-md px-3',
							data.input.view === 'organism'
								? 'bg-white text-slate-900 shadow-sm'
								: 'text-slate-600'
						]}>{t.pulse.viewOrganism}</a
					>
				</nav>
			</div>
		</div>

		{#if data.input.view === 'ward'}
			{#if data.table.rows.length}
				<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
					<table class="w-full min-w-[760px] border-collapse text-sm">
						<thead>
							<tr class="border-b border-slate-200 text-xs text-slate-500">
								<th class="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-medium">
									{t.organism}
								</th>
								<th class="px-3 py-2.5 text-right font-medium">n</th>
								{#each data.table.antibiotics as code (code)}
									<th class="px-2 py-2.5 text-right font-medium" title={abName(code)}>
										<span class="block font-mono font-semibold text-slate-900">{code}</span>
										<span class="block text-[11px]">{abName(code).split('-')[0].slice(0, 10)}</span>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each data.table.rows as row (row.organism)}
								{@const lowN = w4 && row.recentIsolates < 30}
								<tr class="border-b border-slate-100 last:border-0">
									<th
										scope="row"
										class="sticky left-0 z-10 bg-white px-3 py-3 text-left align-top font-medium whitespace-nowrap italic shadow-[1px_0_0_#E2E8F0]"
									>
										<span class="sm:hidden" title={row.organism}>{shortName(row.organism)}</span
										><span class="hidden sm:inline">{row.organism}</span>
										{#if lowN}<span
												class="mt-0.5 block max-w-[7rem] text-[11px] font-normal whitespace-normal text-amber-800 not-italic sm:max-w-none"
												>{t.insufficient}</span
											>{/if}
									</th>
									<td
										class="px-3 py-3 text-right align-top font-mono text-xs whitespace-nowrap text-slate-500"
										>{w4 ? row.recentIsolates : row.annualIsolates}</td
									>
									{#each row.cells as cell (cell.code)}
										{@const main = w4 ? cell.recent : cell.annual}
										{@const other = w4 ? cell.annual : cell.recent}
										{@const on =
											data.cell?.organism === row.organism && data.cell?.code === cell.code}
										{@const o = data.outlook[row.organism]?.[cell.code]}
										{@const drift = !!o && o.trend === 'rising' && !cell.rise}
										<td
											class={[
												'p-0 text-right align-top',
												cell.rise && w4 && !lowN && 'bg-rose-50',
												drift && o.warning && 'bg-amber-50'
											]}
										>
											{#if cell.annual.n === 0 && cell.recent.n === 0}
												<span class="block px-2 py-3 text-slate-400" title={t.notTested}>–</span>
											{:else}
												<a
													href="{resolve('/')}?{q({
														cellOrg: row.organism,
														cellAb: cell.code
													})}#detail"
													class={[
														'block px-2 py-3 whitespace-nowrap hover:bg-teal-50',
														on && 'ring-2 ring-teal-700 ring-inset'
													]}
												>
													<span
														class={[
															'block font-semibold tabular-nums',
															lowN || main.n === 0
																? 'text-slate-400'
																: cell.rise
																	? 'text-rose-700'
																	: 'text-slate-900'
														]}
														>{lowN || main.n === 0 ? '—' : pct(main.r)}{#if drift}<span
																class="ml-0.5 text-amber-700"
																title="{t.forecast.badge}: +{o.slope} / {fi ? 'kk' : 'month'}"
																><span aria-hidden="true">↗</span><span class="sr-only"
																	>{t.forecast.badge}</span
																></span
															>{/if}</span
													>
													<span class="block text-[11px] text-slate-500 tabular-nums"
														>{lowN ? pct(cell.annual.r) : other.n ? pct(other.r) : '–'}</span
													>
												</a>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="mt-2 text-xs text-slate-500">
					{t.pulse.tableHint}. {t.pulse.legend}
					<span class="text-amber-800">{t.forecast.legend}.</span>
				</p>
			{:else}
				<p class="rounded-lg border border-slate-200 bg-white p-6 text-slate-500">
					{t.pulse.noData}
				</p>
			{/if}
		{:else if data.byOrganism}
			<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white px-2 py-1">
				<table class="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
					<thead>
						<tr class="text-xs text-slate-500">
							<th class="px-2 py-2 text-left font-medium">{t.ward}</th>
							{#each data.byOrganism.codes as code (code)}
								<th class="px-1 py-2 text-center font-medium" title={abName(code)}>
									<span class="block font-mono font-semibold text-slate-900">{code}</span>
									<span class="block truncate text-[11px]"
										>{abName(code).split('-')[0].slice(0, 11)}</span
									>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each data.byOrganism.rows as row (row.ward)}
							<tr>
								<th
									scope="row"
									class={[
										'px-2 py-1.5 text-left font-medium whitespace-nowrap',
										row.ward === data.input.ward && 'text-teal-800'
									]}
								>
									<span class="mr-1.5 font-mono text-xs text-slate-500">{row.ward}</span>{wardName(
										row.ward
									)}
								</th>
								{#each row.cells as cell (cell.code)}
									{@const s = w4 ? cell.recent : cell.annual}
									{@const on =
										row.ward === data.input.ward &&
										data.cell?.organism === data.input.organism &&
										data.cell?.code === cell.code}
									<td class="p-0">
										<a
											href="{resolve('/')}?{q({
												ward: row.ward,
												cellOrg: data.input.organism,
												cellAb: cell.code
											})}#detail"
											aria-label="{row.ward} {abName(cell.code)}: {s.reliable
												? pctP(s.p)
												: t.insufficient}"
											class={[
												'block min-h-[52px] rounded-md border px-1 py-2 text-center',
												tint(s),
												on
													? 'border-teal-700 ring-1 ring-teal-700'
													: 'border-transparent hover:border-slate-300'
											]}
										>
											<span class="block font-semibold tabular-nums"
												>{s.reliable ? pctP(s.p) : '—'}</span
											>
											<span class="block text-[11px] text-slate-500">n={s.n}</span>
										</a>
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
		{/if}
		{#if !data.cell}<p class="mt-2 text-sm text-slate-500">{t.pulse.pickCell}</p>{/if}
	</section>

	{#if data.cell}
		{@const c = data.cell}
		<section
			id="detail"
			aria-labelledby="detail-title"
			class="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-6"
		>
			<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 id="detail-title" class="text-lg font-semibold">
						<span class="italic">{c.organism}</span> · {abName(c.code)} ({c.code})
					</h2>
					<p class="text-sm text-slate-600">
						{wardName(data.input.ward)} · {t.specimens[data.input.specimen]} · {t.pulse.trend24}
					</p>
				</div>
				<a
					href="{resolve('/')}?{q({ cellOrg: null, cellAb: null })}"
					class="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
					>{t.pulse.closeDetail}</a
				>
			</div>
			<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<div>
					<svg
						viewBox="0 0 {chartWidth.toFixed(0)} 170"
						class="block h-auto w-full"
						role="img"
						aria-label={t.pulse.trend24}
					>
						<line x1="0" y1="150" x2={chartWidth} y2="150" stroke="#DCE3E5" />
						<line
							x1="0"
							y1={cy(20)}
							x2={chartWidth}
							y2={cy(20)}
							stroke="#E8C98A"
							stroke-dasharray="2 3"
						/>
						<text x="0" y={cy(20) - 4} font-size="10" fill="#8A6A1F">{t.forecast.threshold}</text>
						<polyline
							points={line(c.hospital)}
							fill="none"
							stroke="#8A979E"
							stroke-width="1.5"
							stroke-dasharray="4 4"
						/>
						<polyline points={line(c.ward)} fill="none" stroke="#0A6464" stroke-width="2.2" />
						{#if fit}
							<polyline
								points={fit.past}
								fill="none"
								stroke="#B7791F"
								stroke-width="1.2"
								opacity=".6"
							/>
							<polyline
								points={fit.ahead}
								fill="none"
								stroke="#B7791F"
								stroke-width="2"
								stroke-dasharray="5 4"
							/>
							<text x={chartWidth} y="12" text-anchor="end" font-size="10" fill="#8A6A1F"
								>{t.forecast.projection} →</text
							>
						{/if}
						<text x="0" y="166" font-size="10" fill="#5E6E78">{monthLabel(c.ward[0].month)}</text>
						<text x="600" y="166" text-anchor="end" font-size="10" fill="#5E6E78"
							>{monthLabel(c.ward[c.ward.length - 1].month)}</text
						>
					</svg>
					<div class="mt-2 flex flex-wrap gap-5 text-xs text-slate-600">
						<span class="flex items-center gap-1.5"
							><span class="h-0.5 w-5 bg-teal-700"></span>{t.pulse.thisWard} ({data.input
								.ward})</span
						>
						<span class="flex items-center gap-1.5"
							><span class="h-0.5 w-5 border-t border-dashed border-slate-400"
							></span>{t.allWards}</span
						>
					</div>
				</div>
				<div class="flex flex-col gap-4">
					{#each [[t.w4, c.recent], [t.w12, c.annual]] as [label, s] (label)}
						{@const share = s as Proportion}
						<div class="border-b border-slate-100 pb-3">
							<div class="flex items-baseline justify-between">
								<span class="text-sm text-slate-500">{label}</span>
								<span
									class={[
										'text-2xl font-semibold',
										!share.reliable
											? 'text-slate-400'
											: (share.p ?? 0) >= 0.25
												? 'text-rose-700'
												: ''
									]}>{share.n ? pctP(share.p) : '—'}</span
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
									{pctP(share.low)}–{pctP(share.high)}{share.reliable ? '' : ` · ${t.insufficient}`}
								</div>
							{/if}
						</div>
					{/each}
					{#if c.outlook}
						{@const o = c.outlook}
						<div
							class={[
								'rounded-lg px-3 py-2.5 text-sm',
								o.trend === 'rising' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'
							]}
						>
							<p class="text-xs font-semibold tracking-wide uppercase opacity-80">
								{t.forecast.title}
							</p>
							{#if o.trend === 'stable'}
								<p class="mt-1">{t.forecast.stable}</p>
							{:else}
								<p class="mt-1 font-semibold">
									{o.trend === 'rising'
										? t.forecast.rising(String(o.slope))
										: t.forecast.falling(String(o.slope))}
								</p>
								{#if o.monthsToThreshold !== null}
									<p class="mt-1">{t.forecast.reach(t.forecast.months(o.monthsToThreshold))}</p>
								{:else if o.trend === 'rising' && o.current >= o.threshold}
									<p class="mt-1">{t.forecast.above}</p>
								{/if}
								<p class="mt-1 text-xs">{t.forecast.expected(o.horizon, pct(o.projected))}</p>
							{/if}
							<p class="mt-1.5 text-[11px] opacity-70">{t.forecast.method}</p>
						</div>
					{/if}
					<p class="text-xs text-slate-500">{t.explorer.method}</p>
				</div>
			</div>
		</section>
	{/if}

	<section aria-labelledby="hospital">
		<h2 id="hospital" class="mb-3 text-[17px] font-semibold">{t.pulse.hospitalTitle}</h2>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">
			{#each data.hospital as w (w.code)}
				<a
					href="{resolve('/')}?{new URLSearchParams({ ward: w.code, asOf: data.asOf }).toString()}"
					class={[
						'rounded-lg border px-3 py-2 transition hover:shadow-sm',
						w.level ? LEVEL[w.level] : 'border-slate-200 bg-white text-emerald-700',
						w.code === data.input.ward && 'ring-2 ring-teal-700'
					]}
				>
					<span class="block font-mono text-xs font-semibold text-slate-900">{w.code}</span>
					<span class="block truncate text-[11px] text-slate-500">{fi ? w.nameFi : w.nameEn}</span>
					<span class="mt-1 block text-xs font-medium"
						>{w.level ? t.alerts.levels[w.level] : t.alerts.levels.none}</span
					>
				</a>
			{/each}
		</div>
	</section>
</div>
