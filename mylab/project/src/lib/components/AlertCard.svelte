<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Alert } from '#lib/amr/anomalies.ts';
	import { alertFigures, alertReasons, alertTitle } from '#lib/alertText.ts';
	import { formatDate, messages, type Locale } from '#lib/i18n.ts';

	interface Props {
		alert: Alert;
		rank: number;
		locale: Locale;
		wardName: string;
		antibioticName?: string;
		asOf: string;
		/** Grouped under another alert with the same patients. */
		linked?: boolean;
	}

	let { alert, rank, locale, wardName, antibioticName, asOf, linked = false }: Props = $props();

	const t = $derived(messages[locale]);
	const title = $derived(alertTitle(locale, alert, wardName, antibioticName));
	const reasons = $derived(alertReasons(locale, alert));
	const figures = $derived(alertFigures(locale, alert));

	const specimen = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const c of alert.cases) counts[c.specimen] = (counts[c.specimen] ?? 0) + 1;
		return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'urine';
	});

	// The resistance view with the cell behind the alert open: the drug that rose, or the drug a
	// phenotype defeats (ESBL → ceftriaxone, CPE → meropenem, VRE → vancomycin).
	const PHENOTYPE_DRUG: Record<string, string> = { esbl: 'CRO', cpe: 'MEM', vre: 'VAN' };
	const organism = $derived.by(() => {
		if (alert.organism) return alert.organism;
		const counts: Record<string, number> = {};
		for (const c of alert.cases) counts[c.organism] = (counts[c.organism] ?? 0) + 1;
		return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
	});
	const drug = $derived(
		alert.antibiotic ?? (alert.phenotype ? PHENOTYPE_DRUG[alert.phenotype] : undefined)
	);
	const resistanceQuery = $derived(
		new URLSearchParams({
			ward: alert.ward,
			specimen,
			asOf,
			...(organism && drug ? { cellOrg: organism, cellAb: drug } : {})
		}).toString()
	);
	const SITE: Record<string, string> = { urine: 'febrile-uti', blood: 'blood', wound: 'wound' };
	const advisorQuery = $derived(
		new URLSearchParams({
			ward: alert.ward,
			site: SITE[specimen] ?? 'febrile-uti',
			asOf
		}).toString()
	);

	const inv = $derived(alert.investigation);
	const n = $derived(alert.cases.length);
	const critical = $derived(alert.severity === 'critical');
</script>

<article
	class={[
		'rounded-xl border bg-white p-5',
		critical ? 'border-rose-300' : 'border-amber-300',
		linked && 'ml-6 border-dashed'
	]}
>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<div class="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
				<span class="font-mono text-slate-500">#{rank}</span>
				<span
					class={[
						'rounded px-2 py-0.5 font-semibold',
						critical ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
					]}>{critical ? t.critical : t.warning}</span
				>
				<span class="text-slate-500">{t.alert.kinds[alert.kind]} · {wardName}</span>
			</div>
			<h3 class="text-[17px] font-semibold">{title}</h3>
			{#if linked}<p class="mt-1 text-xs text-teal-700">↳ {t.alert.linked}</p>{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<a
				href="{resolve('/')}?{resistanceQuery}#detail"
				class="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50"
				>{t.alert.openAntibiogram}</a
			>
			<a
				href="{resolve('/advisor')}?{advisorQuery}"
				class="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50"
				>{t.empiric} →</a
			>
		</div>
	</div>

	<div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
		<dl class="grid grid-cols-2 border-y border-slate-200 text-sm">
			<div class="border-r border-slate-200 px-3 py-2.5">
				<dt class="text-xs text-slate-500">{t.alert.observed}</dt>
				<dd class="text-xl font-semibold tabular-nums">{figures.observed}</dd>
			</div>
			<div class="px-3 py-2.5">
				<dt class="text-xs text-slate-500">
					{alert.kind === 'resistance-rise' ? t.alert.baseline : t.alert.expected}
				</dt>
				<dd class="text-xl font-semibold tabular-nums">{figures.expected}</dd>
			</div>
		</dl>
		<div>
			<h4 class="mb-1.5 text-sm font-semibold">{t.alert.why}</h4>
			<ol class="flex flex-col gap-1.5 text-sm">
				{#each reasons as reason, i (i)}
					<li class="grid grid-cols-[22px_minmax(0,1fr)] gap-2">
						<span
							class="flex size-5 items-center justify-center rounded-full bg-teal-50 font-mono text-[11px] font-semibold text-teal-700"
							>{i + 1}</span
						>
						<span class={i === 0 ? '' : 'text-slate-600'}>{reason}</span>
					</li>
				{/each}
			</ol>
		</div>
	</div>

	{#if n > 1 || alert.kind !== 'sentinel'}
		<ul class="mt-4 grid gap-2 text-sm sm:grid-cols-3">
			<li class="rounded-lg bg-slate-50 px-3 py-2">
				<div class="text-xs text-slate-500">{t.alert.hospitalOnset}</div>
				<div class="font-semibold tabular-nums">{inv.hospitalOnset} / {n}</div>
			</li>
			<li class="rounded-lg bg-slate-50 px-3 py-2">
				<div class="text-xs text-slate-500">{t.alert.sameProfile}</div>
				<div class="font-semibold tabular-nums">
					{inv.sameProfile} / {n}
					{#if n >= 3 && inv.sameProfile / n >= 0.5}
						<span class="ml-1 text-xs font-normal text-rose-700">{t.alert.commonStrain}</span>
					{/if}
				</div>
			</li>
			<li class="rounded-lg bg-slate-50 px-3 py-2">
				<div class="text-xs text-slate-500">{t.alert.between}</div>
				<div class="font-semibold tabular-nums">
					{formatDate(locale, inv.firstSeen)} – {formatDate(locale, inv.lastSeen)}
				</div>
			</li>
		</ul>
	{/if}

	{#if !linked}
		<p class="mt-3 text-sm">
			<span class="font-medium">{t.alert.suggested}</span>
			{t.alert.actions[alert.kind]}
		</p>
	{/if}

	<details class="mt-2 text-sm">
		<summary class="cursor-pointer text-slate-500">{t.alert.cases(n)}</summary>
		<table class="mt-2 w-full text-left text-xs">
			<thead class="text-slate-500">
				<tr
					><th class="py-1 font-medium">{t.alert.colDate}</th><th class="font-medium"
						>{t.alert.colPatient}</th
					><th class="font-medium">{t.alert.colOrganism}</th><th class="font-medium"
						>{t.alert.colSpecimen}</th
					><th class="font-medium">{t.alert.colOnset}</th></tr
				>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each alert.cases as c (c.isolateId)}
					<tr>
						<td class="py-1 tabular-nums">{formatDate(locale, c.date)}</td>
						<td class="tabular-nums">{c.patientId}</td>
						<td class="italic">{c.organism}</td>
						<td>{t.specimens[c.specimen]}</td>
						<td>{c.hospitalOnset ? t.alert.onsetHospital : t.alert.onsetCommunity}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
</article>
