<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { alertTitle } from '#lib/alertText.ts';
	import { formatDate, messages, type Locale } from '#lib/i18n.ts';
	import type { BulletinSummaries } from '#lib/server/amr/bulletin.ts';

	let { locale, bulletins }: { locale: Locale; bulletins: BulletinSummaries } = $props();

	const t = $derived(messages[locale].bulletin);
	const fi = $derived(locale === 'fi');
	const b = $derived(bulletins);
	const wardName = $derived(fi ? b.ward.nameFi : b.ward.nameEn);
	const range = $derived(
		t.weekRange(b.week.week, formatDate(locale, b.week.from), formatDate(locale, b.week.to))
	);

	const items = $derived([
		{
			id: `ward|${b.ward.code}|${b.asOf}`,
			query: new URLSearchParams({ kind: 'ward', ward: b.ward.code, asOf: b.asOf }).toString(),
			title: t.wardTitle(wardName),
			tone: b.ward.critical ? 'alert' : b.ward.alerts ? 'watch' : 'clear',
			line: b.ward.headline
				? alertTitle(
						locale,
						b.ward.headline,
						wardName,
						b.ward.antibiotic ? (fi ? b.ward.antibiotic.nameFi : b.ward.antibiotic.name) : undefined
					) + (b.ward.alerts > 1 ? ` ${t.more(b.ward.alerts - 1)}` : '')
				: t.wardClear
		},
		{
			id: `hospital|${b.asOf}`,
			query: new URLSearchParams({ kind: 'hospital', asOf: b.asOf }).toString(),
			title: t.hospitalTitle,
			tone: b.hospital.critical ? 'alert' : b.hospital.alerts ? 'watch' : 'clear',
			line: t.hospitalLine(
				b.hospital.critical,
				b.hospital.alerts - b.hospital.critical,
				b.hospital.newAlerts
			)
		}
	]);

	// Read bulletins are remembered on this device only (a convenience, not a record).
	const KEY = 'aei-bulletins-read';
	let read = $state<string[]>([]);
	onMount(() => {
		try {
			read = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		} catch {
			read = [];
		}
	});
	const unread = $derived(items.filter((i) => !read.includes(i.id)).length);
	function markRead() {
		read = [...new Set([...read, ...items.map((i) => i.id)])].slice(-40);
		try {
			localStorage.setItem(KEY, JSON.stringify(read));
		} catch {
			// Private mode or blocked storage: the badge simply comes back next time.
		}
	}

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	function toggle() {
		open = !open;
		if (open) setTimeout(markRead, 1200);
	}
	const TONE = {
		alert: 'bg-rose-600',
		watch: 'bg-amber-500',
		clear: 'bg-emerald-500'
	};
</script>

<svelte:window
	onclick={(e) => {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') open = false;
	}}
/>

<div class="relative" bind:this={root}>
	<button
		type="button"
		class="relative flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
		aria-label="{t.bell}{unread ? ` (${t.bellNew(unread)})` : ''}"
		aria-expanded={open}
		aria-haspopup="true"
		onclick={toggle}
	>
		<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"
			><path
				d="M10 2.5 A5 5 0 0 1 15 7.5 V11 L16.5 14 H3.5 L5 11 V7.5 A5 5 0 0 1 10 2.5 Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linejoin="round"
			/><path
				d="M8 16.5 A2 2 0 0 0 12 16.5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
			/></svg
		>
		{#if unread}
			<span
				class="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[11px] leading-[18px] font-semibold text-white"
				>{unread}</span
			>
		{/if}
	</button>
	{#if open}
		<div
			class="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[23rem]"
			role="menu"
		>
			<div class="border-b border-slate-100 px-4 py-3">
				<p class="font-semibold">{t.bell}</p>
				<p class="text-xs text-slate-500">{range}</p>
			</div>
			<ul>
				{#each items as item (item.id)}
					<li>
						<a
							href="{resolve('/bulletin')}?{item.query}"
							role="menuitem"
							class="flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
							onclick={() => (open = false)}
						>
							<span class={['mt-1.5 size-2.5 shrink-0 rounded-full', TONE[item.tone as 'alert']]}
							></span>
							<span class="min-w-0 flex-1">
								<span class="flex items-center justify-between gap-2">
									<span class="truncate text-sm font-semibold text-slate-900">{item.title}</span>
									{#if !read.includes(item.id)}<span
											class="shrink-0 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 uppercase"
											>{t.bellNew(1).replace(/^1\s*/, '')}</span
										>{/if}
								</span>
								<span class="mt-0.5 block text-sm text-slate-600">{item.line}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
			<p class="bg-slate-50 px-4 py-2 text-[11px] text-slate-500">{t.issued}</p>
		</div>
	{/if}
</div>
