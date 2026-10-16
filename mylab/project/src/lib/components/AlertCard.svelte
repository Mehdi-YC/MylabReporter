<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Alert } from '#lib/amr/anomalies.ts';

	interface Props {
		alert: Alert;
		wardName: string;
		antibioticName?: string;
		asOf: string;
	}

	let { alert, wardName, antibioticName, asOf }: Props = $props();

	const PHENOTYPE_LABEL = { esbl: 'ESBL', mrsa: 'MRSA', vre: 'VRE', cpe: 'CPE' };
	const KIND_LABEL = {
		sentinel: 'Sentinel organism',
		'phenotype-cluster': 'Resistant-phenotype cluster',
		'resistance-rise': 'Resistance rise',
		'organism-surge': 'Organism surge'
	};
	const ACTIONS = {
		sentinel: 'Contact precautions, notify infection control, screen contacts per local guideline.',
		'phenotype-cluster':
			'Notify infection control; review hand hygiene and contact precautions; consider screening.',
		'resistance-rise':
			'Review empirical therapy for this ward until the signal settles; check for a common source.',
		'organism-surge': 'Check for a common source (device, procedure, staff) with infection control.'
	};

	const pct = (p: number) => `${Math.round(p * 100)} %`;
	const title = $derived.by(() => {
		const ward = `${alert.ward}`;
		switch (alert.kind) {
			case 'sentinel':
				return `${PHENOTYPE_LABEL[alert.phenotype!]} detected in ${ward}`;
			case 'phenotype-cluster':
				return `${PHENOTYPE_LABEL[alert.phenotype!]} cluster in ${ward}: ${alert.observed} cases in 4 weeks`;
			case 'resistance-rise':
				return `${alert.organism} resistant to ${antibioticName ?? alert.antibiotic} in ${ward}: ${pct(alert.observed)}`;
			case 'organism-surge':
				return `Surge of ${alert.organism} in ${ward}: ${alert.observed} isolates in 4 weeks`;
		}
	});

	const detail = $derived(
		alert.kind === 'resistance-rise'
			? `Baseline ${pct(alert.expected)} over the previous 12 months · ${alert.cases.length}/${alert.n} resistant`
			: `Expected ${alert.expected.toFixed(1)} from the previous 12 months`
	);

	const specimen = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const c of alert.cases) counts[c.specimen] = (counts[c.specimen] ?? 0) + 1;
		return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'urine';
	});

	const antibiogramQuery = $derived(
		new URLSearchParams({
			ward: alert.ward,
			specimen,
			asOf,
			...(alert.organism && alert.antibiotic
				? { organism: alert.organism, ab: alert.antibiotic }
				: {})
		}).toString()
	);

	const inv = $derived(alert.investigation);
	const n = $derived(alert.cases.length);
</script>

<article
	class={[
		'rounded-xl border bg-white p-4',
		alert.severity === 'critical' ? 'border-rose-300' : 'border-amber-300'
	]}
>
	<div class="flex flex-wrap items-start justify-between gap-2">
		<div>
			<div class="mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
				<span
					class={[
						'rounded px-1.5 py-0.5',
						alert.severity === 'critical' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-amber-950'
					]}>{alert.severity}</span
				>
				<span class="text-slate-500">{KIND_LABEL[alert.kind]} · {wardName}</span>
			</div>
			<h3 class="font-semibold">{title}</h3>
			<p class="text-sm text-slate-600">
				{detail} · p = {alert.pValue < 0.0001
					? alert.pValue.toExponential(1)
					: alert.pValue.toFixed(4)}
			</p>
		</div>
		<a
			href="{resolve('/antibiogram')}?{antibiogramQuery}#trend"
			class="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50"
			>Open antibiogram →</a
		>
	</div>

	{#if n > 1 || alert.kind !== 'sentinel'}
		<ul class="mt-3 grid gap-2 text-sm sm:grid-cols-3">
			<li class="rounded-lg bg-slate-50 px-3 py-2">
				<div class="text-xs text-slate-500">Hospital-onset (day ≥ 3)</div>
				<div class="font-semibold tabular-nums">{inv.hospitalOnset} / {n}</div>
			</li>
			<li class="rounded-lg bg-slate-50 px-3 py-2">
				<div class="text-xs text-slate-500">Identical antibiogram profile</div>
				<div class="font-semibold tabular-nums">
					{inv.sameProfile} / {n}
					{#if n >= 3 && inv.sameProfile / n >= 0.5}
						<span class="ml-1 text-xs font-normal text-rose-700">possible common strain</span>
					{/if}
				</div>
			</li>
			<li class="rounded-lg bg-slate-50 px-3 py-2">
				<div class="text-xs text-slate-500">Cases between</div>
				<div class="font-semibold tabular-nums">{inv.firstSeen} → {inv.lastSeen}</div>
			</li>
		</ul>
	{/if}

	<p class="mt-3 text-sm"><span class="font-medium">Suggested:</span> {ACTIONS[alert.kind]}</p>

	<details class="mt-2 text-sm">
		<summary class="cursor-pointer text-slate-500">{n} case{n > 1 ? 's' : ''}</summary>
		<table class="mt-2 w-full text-left text-xs">
			<thead class="text-slate-500">
				<tr
					><th class="py-1 font-medium">Date</th><th class="font-medium">Patient</th><th
						class="font-medium">Organism</th
					><th class="font-medium">Specimen</th><th class="font-medium">Onset</th></tr
				>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each alert.cases as c (c.isolateId)}
					<tr>
						<td class="py-1 tabular-nums">{c.date}</td>
						<td class="tabular-nums">{c.patientId}</td>
						<td class="italic">{c.organism}</td>
						<td>{c.specimen}</td>
						<td>{c.hospitalOnset ? 'hospital' : 'community / early'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
</article>
