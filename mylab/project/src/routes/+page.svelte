<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const fmt = new Intl.NumberFormat('en');
	const maxIsolates = $derived(Math.max(1, ...data.byWard.map((w) => w.isolates)));
</script>

<section class="mb-6">
	<h1 class="text-2xl font-semibold tracking-tight">Antibiotic efficacy indicator</h1>
	<p class="mt-1 max-w-3xl text-slate-600">
		Rolling antimicrobial resistance surveillance from the laboratory feed: what the bacteria in
		each ward look like over the last four weeks and the last twelve months.
	</p>
</section>

<section class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	{#each [{ label: 'Cultures', value: fmt.format(data.status.totalCultures) }, { label: 'Isolates', value: fmt.format(data.status.totalIsolates) }, { label: 'Data from', value: data.status.firstDate }, { label: 'Latest sample', value: data.status.lastDate }] as stat (stat.label)}
		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="text-xs font-medium tracking-wide text-slate-500 uppercase">{stat.label}</div>
			<div class="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</div>
		</div>
	{/each}
</section>

<section class="rounded-xl border border-slate-200 bg-white p-5">
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="font-semibold">First isolates per ward, last 4 weeks</h2>
		<span class="text-sm text-slate-500">{data.recent.from} → {data.recent.to}</span>
	</div>
	<table class="w-full text-sm">
		<thead class="text-left text-xs text-slate-500 uppercase">
			<tr>
				<th class="py-2 font-medium">Ward</th>
				<th class="py-2 font-medium">Setting</th>
				<th class="w-1/2 py-2 font-medium">Isolates</th>
				<th class="py-2 text-right font-medium">Hospital-onset</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100">
			{#each data.byWard as ward (ward.code)}
				<tr>
					<td class="py-2"
						><span class="font-medium">{ward.code}</span>
						<span class="text-slate-500">· {ward.nameEn}</span></td
					>
					<td class="py-2 text-slate-600"
						>{ward.institution === 'primary_care'
							? 'Primary care'
							: ward.type === 'in'
								? 'Inpatient'
								: 'Outpatient'}</td
					>
					<td class="py-2">
						<div class="flex items-center gap-2">
							<div
								class="h-2 rounded-full bg-teal-600"
								style:width="{(ward.isolates / maxIsolates) * 100}%"
							></div>
							<span class="tabular-nums">{ward.isolates}</span>
						</div>
					</td>
					<td class="py-2 text-right tabular-nums"
						>{ward.type === 'in' ? ward.hospitalOnset : '–'}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="mt-4 text-xs text-slate-500">
		Data reloaded {new Date(data.status.loadedAt).toLocaleString('en-GB')} · first isolate per patient,
		organism and specimen type · hospital-onset = inpatient sample from hospital day 3.
	</p>
</section>
