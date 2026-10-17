<script lang="ts">
	import { resolve } from '$app/paths';
	import { alertReasons, alertTitle } from '#lib/alertText.ts';
	import { formatDate, formatPercent, messages } from '#lib/i18n.ts';
	import type { BulletinAlert } from '#lib/server/amr/bulletin.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const m = $derived(messages[data.locale]);
	const t = $derived(m.bulletin);
	const fi = $derived(data.locale === 'fi');
	const b = $derived(data.bulletin);
	const pct = (x: number | null) => formatPercent(data.locale, x);
	const wardName = (code: string) => {
		const w = data.wards.find((x) => x.code === code);
		return w ? (fi ? w.nameFi : w.nameEn) : code;
	};
	const abName = (code: string | null) => {
		const a = data.antibiotics.find((x) => x.code === code);
		return a ? (fi ? a.nameFi : a.name) : (code ?? '');
	};
	const range = $derived(
		t.weekRange(
			b.week.week,
			formatDate(data.locale, b.week.from),
			formatDate(data.locale, b.week.to)
		)
	);
	const title = (a: BulletinAlert) =>
		alertTitle(data.locale, a, wardName(a.ward), a.antibiotic ? abName(a.antibiotic) : undefined);
	const main = $derived(b.alerts.filter((a) => !a.linkedTo));
	const critical = $derived(main.filter((a) => a.severity === 'critical').length);
	const fresh = $derived(main.filter((a) => a.isNew).length);
	const tone = $derived(critical ? 'alert' : main.length ? 'watch' : 'clear');
	const TONE = {
		alert: { chip: 'bg-rose-50 text-rose-700 border-rose-200', level: 'critical' },
		watch: { chip: 'bg-amber-50 text-amber-800 border-amber-200', level: 'warning' },
		clear: {
			chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
			level: 'none'
		}
	};
	const LEVEL_TILE = {
		critical: 'border-rose-300 bg-rose-50 text-rose-700',
		warning: 'border-amber-300 bg-amber-50 text-amber-800',
		sentinel: 'border-rose-300 bg-rose-50 text-rose-800',
		none: 'border-emerald-200 bg-emerald-50/50 text-emerald-700'
	};
	const wardQuery = $derived(
		b.kind === 'ward' ? new URLSearchParams({ ward: b.ward, asOf: data.asOf }).toString() : ''
	);
</script>

<svelte:head>
	<title>AEI · {t.docTitle} · {b.kind === 'ward' ? wardName(b.ward) : t.hospital}</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
	{#if b.kind === 'ward'}
		<a
			href="{resolve('/')}?{wardQuery}"
			class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-teal-800 hover:bg-slate-50"
			>{t.openApp}</a
		>
	{:else}
		<a
			href="{resolve('/alerts')}?asOf={data.asOf}"
			class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-teal-800 hover:bg-slate-50"
			>{t.openApp}</a
		>
	{/if}
	<button
		type="button"
		class="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
		onclick={() => window.print()}>{t.print}</button
	>
</div>

<article
	class="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
>
	<header class="bg-[#13222D] px-6 py-6 text-white sm:px-10">
		<p class="font-mono text-xs tracking-[0.3em] text-[#8FC7C1] uppercase">
			AEI · Tyks Laboratories × Mylab
		</p>
		<h1 class="mt-2 text-2xl font-semibold sm:text-3xl">
			{t.docTitle} · {b.kind === 'ward' ? wardName(b.ward) : t.hospital}
		</h1>
		<p class="mt-1 text-sm text-[#B9CED0]">
			{range} · {b.kind === 'ward' ? t.audienceWard : t.audienceHospital}
		</p>
	</header>

	<div class="flex flex-col gap-7 px-6 py-6 sm:px-10">
		<!-- At a glance -->
		<section>
			<h2 class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{t.glance}</h2>
			<div class="grid gap-3 sm:grid-cols-3">
				<div class="rounded-lg border border-slate-200 p-4">
					<p class="text-xs text-slate-500">{b.kind === 'ward' ? t.status : t.alerts}</p>
					<p
						class={[
							'mt-2 inline-block rounded border px-2 py-0.5 text-sm font-semibold',
							TONE[tone].chip
						]}
					>
						{m.alerts.levels[TONE[tone].level as 'none']}
					</p>
					{#if main.length}<p class="mt-1 text-sm text-slate-600">
							{m.alerts.counts(critical, main.length - critical)}
						</p>{/if}
				</div>
				<div class="rounded-lg border border-slate-200 p-4">
					<p class="text-xs text-slate-500">{t.isolatesWeek}</p>
					<p class="mt-1 text-2xl font-semibold tabular-nums">{b.volume.thisWeek}</p>
					<p class="text-xs text-slate-500">{t.previousWeek(b.volume.previousWeek)}</p>
				</div>
				<div class="rounded-lg border border-slate-200 p-4">
					<p class="text-xs text-slate-500">
						{b.kind === 'ward' ? t.newAlerts : t.wardsAffected}
					</p>
					<p class="mt-1 text-2xl font-semibold tabular-nums">
						{b.kind === 'ward' ? fresh : new Set(main.map((a) => a.ward)).size}
					</p>
					{#if b.kind === 'hospital'}<p class="text-xs text-slate-500">
							{t.newAlerts}: {fresh}
						</p>{/if}
				</div>
			</div>
		</section>

		{#if b.kind === 'hospital'}
			<section>
				<h2 class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
					{t.wardStatus}
				</h2>
				<div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
					{#each data.wards as w (w.code)}
						{@const level = b.levels[w.code] ?? 'none'}
						<div class={['rounded-lg border px-2.5 py-2', LEVEL_TILE[level]]}>
							<div class="font-mono text-xs font-semibold text-slate-900">{w.code}</div>
							<div class="truncate text-[11px] text-slate-500">{fi ? w.nameFi : w.nameEn}</div>
							<div class="mt-1 text-[11px] font-medium">{m.alerts.levels[level]}</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Alerts, most urgent first; signals with the same patients sit under their alert. -->
		<section>
			<h2 class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{t.alerts}</h2>
			{#if b.alerts.length}
				<ol class="flex flex-col gap-2">
					{#each b.alerts as a (a.id)}
						<li
							class={[
								'break-inside-avoid rounded-lg border px-4 py-3',
								a.linkedTo ? 'ml-6 border-slate-200 bg-slate-50' : 'border-slate-200',
								!a.linkedTo && a.severity === 'critical' && 'border-l-4 border-l-rose-600',
								!a.linkedTo && a.severity === 'warning' && 'border-l-4 border-l-amber-500'
							]}
						>
							<div class="flex flex-wrap items-center gap-2">
								<span
									class={[
										'rounded px-1.5 py-0.5 text-[11px] font-semibold',
										a.severity === 'critical'
											? 'bg-rose-50 text-rose-700'
											: 'bg-amber-50 text-amber-800'
									]}>{a.severity === 'critical' ? m.critical : m.warning}</span
								>
								<span
									class={[
										'rounded px-1.5 py-0.5 text-[11px] font-medium',
										a.isNew ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'
									]}>{a.isNew ? t.isNew : t.ongoing}</span
								>
								{#if a.linkedTo}<span class="text-[11px] text-slate-500">{t.linked}</span>{/if}
							</div>
							<p class="mt-1.5 font-semibold">{title(a)}</p>
							<p class="mt-0.5 text-sm text-slate-600">{alertReasons(data.locale, a)[0]}</p>
							{#if !a.linkedTo}
								<p class="mt-1 text-sm">
									<span class="font-medium">{m.alert.suggested}</span>
									{m.alert.actions[a.kind]}
								</p>
							{/if}
						</li>
					{/each}
				</ol>
			{:else}
				<p class="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
					{b.kind === 'ward' ? t.noAlerts : t.noAlertsHospital}
				</p>
			{/if}
		</section>

		{#if b.kind === 'ward'}
			<div class="grid gap-6 sm:grid-cols-2">
				<section class="break-inside-avoid">
					<h2 class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
						{t.give} · {m.specimens[b.specimen]}
					</h2>
					<ul class="flex flex-col gap-2">
						{#each b.empiric as e (e.site)}
							<li class="rounded-lg border border-slate-200 px-4 py-3">
								<div class="text-sm text-slate-500">{m.pulse.empiricSites[e.key]}</div>
								<div class="flex items-baseline justify-between gap-3">
									<span class="text-[17px] font-semibold">{e.code ? abName(e.code) : '–'}</span>
									<span
										class={[
											'font-semibold tabular-nums',
											e.adequate ? 'text-emerald-700' : 'text-amber-800'
										]}>{pct(e.coverage)}</span
									>
								</div>
								{#if !e.adequate}<div class="text-xs text-amber-800">{m.pulse.noAdequate}</div>{/if}
								{#if e.reserve}<div class="text-xs text-rose-700">
										{m.pulse.reserveSevere(abName(e.reserve.code), pct(e.reserve.coverage))}
									</div>{/if}
							</li>
						{/each}
					</ul>
					{#if b.warned.length}
						<p class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
							{m.pulse.avoid(b.warned.map((c) => abName(c)).join(', '))}
						</p>
					{/if}
				</section>
				<section class="break-inside-avoid">
					<h2 class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
						{t.changes}
					</h2>
					{#if b.changes.length}
						<ul class="flex flex-col gap-2">
							{#each b.changes as c (c.organism + c.code)}
								<li class="rounded-lg border border-slate-200 px-4 py-2.5">
									<div class="text-sm text-slate-600 italic">{c.organism}</div>
									<div class="font-semibold">
										{m.pulse.changeLine(abName(c.code), pct(c.recent), pct(c.annual))}
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-slate-600">{m.pulse.noChanges}</p>
					{/if}
					{#if b.early.length}
						<h3 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-amber-800 uppercase">
							↗ {t.slow}
						</h3>
						<ul class="flex flex-col gap-2">
							{#each b.early as e (e.organism + e.code)}
								<li class="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2.5">
									<div class="text-sm text-slate-600 italic">{e.organism}</div>
									<div class="text-sm font-semibold">
										{m.forecast.line(abName(e.code), pct(e.current), String(e.slope))}
									</div>
									{#if e.warning && e.monthsToThreshold !== null}<div
											class="text-xs text-amber-800"
										>
											{m.forecast.reach(m.forecast.months(e.monthsToThreshold))}
										</div>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		{/if}

		<p class="border-t border-slate-200 pt-4 text-xs text-slate-500">{t.footer}</p>
	</div>
</article>
