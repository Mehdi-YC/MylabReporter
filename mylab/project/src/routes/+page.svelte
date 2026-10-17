<script lang="ts">
	import { resolve } from '$app/paths';
	import { alertReasons, alertTitle, formatP } from '#lib/alertText.ts';
	import { formatDate, formatPercent, formatRange, messages } from '#lib/i18n.ts';
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
	const w4 = $derived(data.input.window === '4w');
	const submit = (e: Event) =>
		(e.currentTarget as HTMLSelectElement | HTMLInputElement).form?.requestSubmit();

	const query = (params: Record<string, string>) =>
		new URLSearchParams({
			ward: data.input.ward,
			specimen: data.input.specimen,
			...params
		}).toString();

	// Trend chart geometry (viewBox 400 × 150).
	const trendMax = $derived(
		Math.max(20, ...(data.trend?.points.map((p) => p.r ?? 0) ?? []), data.trend?.baseline ?? 0)
	);
	const tx = (i: number) => (i * 400) / 11;
	const ty = (v: number) => 130 - (v / trendMax) * 112;
	const trendPoints = $derived(
		data.trend
			? data.trend.points
					.map((p, i) => (p.r === null ? null : `${tx(i).toFixed(1)},${ty(p.r).toFixed(1)}`))
					.filter(Boolean)
					.join(' ')
			: ''
	);
	const lastPoint = $derived(data.trend?.points.at(-1) ?? null);
	const monthLabel = (m: string) =>
		fi
			? `${Number(m.slice(5))}/${m.slice(0, 4)}`
			: new Date(`${m}-01T00:00:00Z`).toLocaleString('en-GB', {
					month: 'short',
					year: 'numeric',
					timeZone: 'UTC'
				});
	const weeklyMax = $derived(Math.max(1, ...(data.weekly?.points.map((p) => p.value) ?? [])));

	const LEVEL = {
		critical: 'border-rose-300 bg-rose-50 text-rose-700',
		warning: 'border-amber-300 bg-amber-50 text-amber-800',
		sentinel: 'border-rose-300 bg-white text-rose-700'
	};
</script>

<form
	method="GET"
	class="-mx-4 -mt-6 mb-6 border-b border-slate-200 bg-white px-4 py-3 sm:-mx-8 sm:px-8"
>
	<div class="flex flex-wrap items-end gap-4">
		<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
			{t.ward}
			<select
				name="ward"
				class="min-h-10 rounded-md border-slate-300 text-sm text-slate-900"
				onchange={submit}
			>
				{#each data.wards as w (w.code)}
					<option value={w.code} selected={data.input.ward === w.code}
						>{fi ? w.nameFi : w.nameEn} ({w.code})</option
					>
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
				{#each ['urine', 'blood', 'wound'] as const as s (s)}
					<option value={s} selected={data.input.specimen === s}>{t.specimens[s]}</option>
				{/each}
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
		<div class="flex-1"></div>
		<a
			href="{resolve('/station')}?{new URLSearchParams({
				ward: data.input.ward,
				asOf: data.asOf
			}).toString()}"
			class="text-sm font-medium text-teal-700 hover:underline">{t.nav.station} →</a
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

	{#if data.primary}
		{@const p = data.primary}
		<section
			aria-labelledby="primary-anomaly"
			class={[
				'grid gap-5 rounded-xl border bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
				p.severity === 'critical' ? 'border-rose-300' : 'border-amber-300'
			]}
		>
			<div class="flex flex-col gap-2.5">
				<div class="flex flex-wrap items-center gap-2.5 text-xs">
					<span
						class={[
							'rounded px-2 py-0.5 font-semibold',
							p.severity === 'critical' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
						]}>{p.severity === 'critical' ? t.critical : t.warning}</span
					>
					<span class="text-slate-500"
						>{t.alert.kinds[p.kind]} · {formatP(data.locale, p.pValue)}</span
					>
				</div>
				<h2 id="primary-anomaly" class="text-xl font-semibold">
					{alertTitle(
						data.locale,
						{ ...p, ward: data.input.ward },
						wardName(data.input.ward),
						p.antibiotic ? abName(p.antibiotic) : undefined
					)}
				</h2>
				{#each alertReasons(data.locale, { ...p, ward: data.input.ward }) as reason, i (i)}
					<p class={i === 0 ? 'text-[15px]' : 'text-sm text-slate-600'}>{reason}</p>
				{/each}
				{#if p.cases > 1}
					<ul class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
						<li>
							{t.alert.hospitalOnset}:
							<span class="font-semibold text-slate-900"
								>{p.investigation.hospitalOnset}/{p.cases}</span
							>
						</li>
						<li>
							{t.alert.sameProfile}:
							<span class="font-semibold text-slate-900"
								>{p.investigation.sameProfile}/{p.cases}</span
							>
						</li>
						<li>
							{t.alert.between}:
							<span class="font-mono text-xs text-slate-900"
								>{formatDate(data.locale, p.investigation.firstSeen)} – {formatDate(
									data.locale,
									p.investigation.lastSeen
								)}</span
							>
						</li>
					</ul>
				{/if}
				{#if data.wardAlerts.total > 1}
					<p class="text-sm text-slate-500">{t.pulse.moreAlerts(data.wardAlerts.total - 1)}</p>
				{/if}
			</div>
			<a
				href="{resolve('/alerts')}?asOf={data.asOf}"
				class="min-h-11 rounded-md bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-800"
				>{t.pulse.openAnomaly}</a
			>
		</section>
	{:else}
		<section class="flex items-center gap-4 rounded-xl border border-emerald-200 bg-white p-5">
			<svg width="40" height="40" viewBox="0 0 56 56" aria-hidden="true"
				><circle cx="28" cy="28" r="26" fill="#E3F0E7" /><path
					d="M18 28.5 L25 35 L38.5 21"
					fill="none"
					stroke="#2E6B45"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
			<div>
				<h2 class="font-semibold">{t.noDeviations}</h2>
				<p class="text-sm text-slate-600">{t.pulse.calm}</p>
			</div>
		</section>
	{/if}

	<section aria-label="KPI" class="grid grid-cols-2 border-y border-slate-200 lg:grid-cols-4">
		<div class="flex flex-col gap-1 border-slate-200 px-5 py-4">
			<span class="text-sm text-slate-500">{t.pulse.kpiIsolates}</span>
			<span class="text-[28px] font-semibold tabular-nums">{data.kpi.recentIsolates}</span>
			<span class="text-sm text-slate-600">{t.pulse.kpiIsolatesSub(data.kpi.annualIsolates)}</span>
		</div>
		<div class="flex flex-col gap-1 border-l border-slate-200 px-5 py-4">
			<span class="text-sm text-slate-500">{t.pulse.kpiTop}</span>
			{#if data.table.topRise}
				<span class="text-[28px] font-semibold text-rose-700 tabular-nums"
					>{pct(data.table.topRise.recent)}</span
				>
				<span class="text-sm text-slate-600"
					><span class="italic">{data.table.topRise.organism}</span> ·
					<span class="font-mono text-xs">{data.table.topRise.code}</span>
					· {t.w12Short}
					{pct(data.table.topRise.annual)}</span
				>
			{:else}
				<span class="text-[28px] font-semibold">–</span>
				<span class="text-sm text-slate-600">{t.pulse.kpiTopNone}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-1 border-slate-200 px-5 py-4 lg:border-l">
			<span class="text-sm text-slate-500">{t.pulse.kpiAlerts}</span>
			<span
				class={[
					'text-[28px] font-semibold tabular-nums',
					data.wardAlerts.critical && 'text-rose-700'
				]}>{data.wardAlerts.total}</span
			>
			<span class="text-sm text-slate-600"
				>{t.pulse.kpiAlertsSub(
					data.wardAlerts.critical,
					data.wardAlerts.total - data.wardAlerts.critical
				)}</span
			>
		</div>
		<div class="flex flex-col gap-1 border-l border-slate-200 px-5 py-4">
			<span class="text-sm text-slate-500">{t.pulse.kpiOnset}</span>
			<span class="text-[28px] font-semibold tabular-nums"
				>{data.kpi.wardType === 'in' ? data.kpi.hospitalOnset : '–'}</span
			>
			<span class="text-sm text-slate-600">{t.pulse.kpiOnsetSub}</span>
		</div>
	</section>

	<div class="flex flex-wrap items-start gap-7">
		<section aria-labelledby="sr-table" class="min-w-0 flex-[999_1_640px]">
			<div class="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="sr-table" class="text-[17px] font-semibold">{t.pulse.tableTitle}</h2>
				<span class="text-xs text-slate-500">{t.pulse.tableHint}</span>
			</div>
			{#if data.table.rows.length}
				<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
					<table class="w-full min-w-[760px] border-collapse text-sm">
						<thead>
							<tr class="border-b border-slate-200 text-xs text-slate-500">
								<th class="px-3 py-2.5 text-left font-medium">{t.organism}</th>
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
										class="px-3 py-3 text-left align-top font-medium whitespace-nowrap italic"
									>
										{row.organism}
										{#if lowN}<span
												class="mt-0.5 block text-[11px] font-normal text-amber-800 not-italic"
												>{t.insufficient}</span
											>{/if}
									</th>
									<td
										class="px-3 py-3 text-right align-top font-mono text-xs whitespace-nowrap text-slate-500"
										>{w4
											? `${row.recentIsolates} / ${row.annualIsolates}`
											: `${row.annualIsolates} / ${row.recentIsolates}`}</td
									>
									{#each row.cells as cell (cell.code)}
										{@const main = w4 ? cell.recent : cell.annual}
										{@const other = w4 ? cell.annual : cell.recent}
										{@const empty = cell.annual.n === 0 && cell.recent.n === 0}
										<td
											class={[
												'px-2 py-3 text-right align-top whitespace-nowrap',
												cell.rise && w4 && !lowN && 'bg-rose-50'
											]}
										>
											{#if empty}
												<span class="text-slate-400" title={t.notTested}>–</span>
											{:else}
												<span
													class={[
														'block font-semibold tabular-nums',
														lowN || main.n === 0
															? 'text-slate-400'
															: cell.rise
																? 'text-rose-700'
																: 'text-slate-900'
													]}>{lowN || main.n === 0 ? '—' : pct(main.r)}</span
												>
												<span class="block text-[11px] text-slate-500 tabular-nums"
													>{lowN ? pct(cell.annual.r) : other.n ? pct(other.r) : '–'}</span
												>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="mt-2 text-xs text-slate-500">{t.pulse.legend}</p>
			{:else}
				<p class="rounded-lg border border-slate-200 bg-white p-6 text-slate-500">
					{t.pulse.noData}
				</p>
			{/if}
		</section>

		<aside class="flex min-w-0 flex-[1_1_360px] flex-col gap-7">
			{#if data.trend}
				<section aria-labelledby="trend-title">
					<h2 id="trend-title" class="text-[17px] font-semibold">
						<span class="italic">{data.trend.organism}</span> · {abName(data.trend.code)} ({data
							.trend.code})
					</h2>
					<p class="mb-2.5 text-xs text-slate-500">
						{t.pulse.trendTitle} · {wardName(data.input.ward)} · {t.specimens[data.input.specimen]}
					</p>
					<a
						href="{resolve('/antibiogram')}?{query({
							organism: data.trend.organism,
							ab: data.trend.code,
							asOf: data.asOf
						})}#trend"
						class="block"
						aria-label={t.alert.openAntibiogram}
					>
						<svg
							viewBox="0 0 400 150"
							class="block h-auto w-full"
							role="img"
							aria-label="{t.pulse.trendTitle}: {lastPoint ? pct(lastPoint.r) : ''}"
						>
							<line x1="0" y1="130" x2="400" y2="130" stroke="#DCE3E5" />
							{#if data.trend.baseline !== null}
								<line
									x1="0"
									y1={ty(data.trend.baseline)}
									x2="400"
									y2={ty(data.trend.baseline)}
									stroke="#5E6E78"
									stroke-dasharray="3 4"
								/>
								<text
									x="400"
									y={ty(data.trend.baseline) - 5}
									text-anchor="end"
									font-size="10"
									fill="#5E6E78">{t.pulse.baseline(pct(data.trend.baseline))}</text
								>
							{/if}
							<polyline points={trendPoints} fill="none" stroke="#0A6464" stroke-width="2" />
							{#if lastPoint && lastPoint.r !== null}
								<circle
									cx="400"
									cy={ty(lastPoint.r)}
									r="4"
									fill={data.table.topRise ? '#A33232' : '#0A6464'}
								/>
								<text
									x="394"
									y={ty(lastPoint.r) - 10}
									text-anchor="end"
									font-size="12"
									font-weight="600"
									fill={data.table.topRise ? '#A33232' : '#0A6464'}>{pct(lastPoint.r)}</text
								>
							{/if}
							<text x="0" y="146" font-size="10" fill="#5E6E78"
								>{monthLabel(data.trend.points[0].month)}</text
							>
							<text x="400" y="146" text-anchor="end" font-size="10" fill="#5E6E78"
								>{monthLabel(data.trend.points[11].month)}</text
							>
						</svg>
					</a>
					{#if data.weekly}
						<h3 class="mt-4 mb-2 text-sm font-semibold text-slate-600">
							{data.weekly.label === 'resistant'
								? `${data.trend.code} R`
								: data.weekly.label.toUpperCase()} · {fi ? 'viikoittain' : 'per week'}
						</h3>
						<div
							class="grid h-16 grid-cols-16 items-end gap-[3px]"
							role="img"
							aria-label={data.weekly.points.map((p) => p.value).join(', ')}
						>
							{#each data.weekly.points as w, i (w.to)}
								<div
									title="{formatDate(data.locale, w.to)}: {w.value}"
									class={['rounded-t-sm', i >= 12 ? 'bg-rose-600' : 'bg-teal-200']}
									style:height="{Math.max(2, (w.value / weeklyMax) * 64)}px"
								></div>
							{/each}
						</div>
						<div class="mt-1 flex justify-between text-[10px] text-slate-500">
							<span>{formatDate(data.locale, data.weekly.points[0].to)}</span><span
								>{formatDate(data.locale, data.weekly.points[15].to)}</span
							>
						</div>
					{/if}
				</section>
			{/if}

			<section aria-labelledby="empiric" class="border-t border-slate-200 pt-5">
				<h2 id="empiric" class="mb-3 text-[17px] font-semibold">{t.empiric}</h2>
				{#each data.empiric as e (e.site)}
					<a
						href="{resolve('/advisor')}?{new URLSearchParams({
							ward: data.input.ward,
							site: e.site,
							asOf: data.asOf
						}).toString()}"
						class="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2.5 hover:bg-slate-50"
					>
						<span>
							<span class="block text-sm text-slate-500">{t.pulse.empiricSites[e.key]}</span>
							{#if e.code}
								<span class="block font-semibold text-slate-900"
									>{abName(e.code)}
									<span class="font-mono text-xs text-slate-500">{e.code}</span></span
								>
							{/if}
							{#if !e.adequate}<span class="block text-xs text-amber-800">{t.pulse.noAdequate}</span
								>{/if}
						</span>
						<span class="text-right">
							<span
								class={[
									'block text-lg font-semibold',
									e.adequate ? 'text-emerald-700' : 'text-amber-800'
								]}>{pct(e.coverage)}</span
							>
							<span class="block text-[11px] text-slate-500">{t.coverage}</span>
						</span>
					</a>
				{/each}
				{#if data.warned.length}
					<p class="mt-3 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
						{t.pulse.adviceWarn(data.warned.map((c) => `${abName(c)} (${c})`).join(', '))}
					</p>
				{/if}
				<p class="mt-2.5 text-xs text-slate-500">{t.decisionSupport}</p>
			</section>
		</aside>
	</div>

	<section aria-labelledby="hospital">
		<h2 id="hospital" class="mb-3 text-[17px] font-semibold">{t.pulse.hospitalTitle}</h2>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">
			{#each data.hospital as w (w.code)}
				<a
					href="{resolve('/')}?{new URLSearchParams({ ward: w.code, asOf: data.asOf }).toString()}"
					data-sveltekit-reset="false"
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
					<span class="block text-[11px] text-slate-500 tabular-nums"
						>{t.w4Short}: {w.isolates}</span
					>
				</a>
			{/each}
		</div>
	</section>
</div>
