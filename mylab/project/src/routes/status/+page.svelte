<script lang="ts">
	import { formatDate, formatDateTime, formatNumber, messages } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const t = $derived(messages[data.locale]);
	const num = (n: number) => formatNumber(data.locale, n);
	const failing = $derived(data.checks.filter((c) => !c.ok).length);

	const volumes = $derived([
		[t.status.cultures, num(data.totals.cultures)],
		[t.status.isolates, num(data.totals.isolates)],
		[t.status.results, num(data.totals.results)],
		[t.status.cultures7, num(data.totals.cultures7)],
		[t.status.results7, num(data.totals.results7)],
		[t.status.latestDay, formatDate(data.locale, data.lastDate)]
	]);
	const runtime = $derived([
		[t.status.loadedAt, formatDateTime(data.locale, new Date(data.loadedAt))],
		[t.status.refresh, `${data.refreshSeconds} s`],
		[t.status.version, data.version]
	]);
</script>

<div class="flex flex-col gap-7">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-[28px] font-semibold tracking-tight">{t.status.title}</h1>
			<p class="mt-1 text-sm text-slate-600">{t.status.subtitle}</p>
		</div>
		<span
			role="status"
			class={[
				'flex items-center gap-2.5 rounded-md px-3.5 py-2 text-[15px] font-medium',
				failing ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
			]}
		>
			<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"
				><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" stroke-width="1.6" /><path
					d="M5.5 9.2 L8 11.6 L12.6 6.6"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
			{failing ? t.status.issues(failing) : t.status.healthy}
		</span>
	</div>

	<section aria-labelledby="pipeline">
		<h2 id="pipeline" class="mb-3 text-[17px] font-semibold">{t.status.pipeline}</h2>
		<ol
			class="grid grid-cols-2 rounded-lg border border-slate-200 bg-white md:grid-cols-3 xl:grid-cols-6"
		>
			{#each t.status.stages as [name, desc], i (name)}
				<li class={['flex flex-col gap-1.5 px-4 py-4', i && 'border-l border-slate-200']}>
					<span class="flex items-center gap-2">
						<span class="font-mono text-[11px] text-slate-500"
							>{String(i + 1).padStart(2, '0')}</span
						>
						<span class="size-2 rounded-full bg-emerald-500"></span>
						<span class="text-xs font-medium text-emerald-700">{t.status.ok}</span>
					</span>
					<span class="text-[15px] font-semibold">{name}</span>
					<span class="text-sm text-slate-600">{desc}</span>
				</li>
			{/each}
		</ol>
	</section>

	<div class="flex flex-wrap items-start gap-7">
		<section aria-labelledby="volumes" class="min-w-0 flex-[1_1_520px]">
			<h2 id="volumes" class="mb-3 text-[17px] font-semibold">{t.status.volumes}</h2>
			<dl class="grid grid-cols-2 border-t border-slate-200">
				{#each [...volumes, ...runtime] as [label, value] (label)}
					<div class="border-b border-slate-200 py-3.5 pr-4">
						<dt class="text-sm text-slate-500">{label}</dt>
						<dd class="mt-0.5 text-xl font-semibold break-all tabular-nums">{value}</dd>
					</div>
				{/each}
			</dl>
		</section>

		<section aria-labelledby="checks" class="min-w-0 flex-[1_1_420px]">
			<h2 id="checks" class="mb-3 text-[17px] font-semibold">{t.status.checks}</h2>
			<ul class="flex flex-col gap-2.5 text-sm">
				{#each data.checks as c (c.key)}
					<li class="flex items-baseline gap-2.5">
						<span class={c.ok ? 'text-emerald-700' : 'text-rose-700'} aria-hidden="true"
							>{c.ok ? '✓' : '✕'}</span
						>
						<span>{t.status.checkLabels[c.key]}{c.ok ? '' : ` (${num(c.value)})`}</span>
					</li>
				{/each}
				<li class="flex items-baseline gap-2.5">
					<span class="text-emerald-700" aria-hidden="true">✓</span>
					<span>{t.status.checkLabels.guidelines}: {data.guidelines.join(', ')}</span>
				</li>
			</ul>
		</section>
	</div>

	<p class="max-w-4xl border-t border-slate-200 pt-4 text-sm text-slate-600">{t.status.footer}</p>
</div>
