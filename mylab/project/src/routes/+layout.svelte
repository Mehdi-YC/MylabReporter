<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatDate, formatDateTime, messages } from '#lib/i18n.ts';
	import AskChat from '#lib/components/AskChat.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const t = $derived(messages[data.locale]);

	// Four entries: the resistance page (ward pulse, antibiogram and explorer in one), anomalies,
	// empiric guidance and the map. The assistant is the chat at the bottom of every page.
	const nav = $derived([
		{ label: t.nav.pulse, route: '/', href: resolve('/') },
		{ label: t.nav.anomalies, route: '/alerts', href: resolve('/alerts'), badge: true },
		{ label: t.nav.advisor, route: '/advisor', href: resolve('/advisor') },
		{ label: t.nav.map, route: '/map', href: resolve('/map') }
	]);

	// The ward-station view is a kiosk: no application chrome.
	const kiosk = $derived(page.route.id === '/station');

	$effect(() => {
		document.documentElement.lang = data.locale;
	});

	/** Current page without a `?lang=` override, so the toggle's choice wins. */
	const backTo = $derived.by(() => {
		const search = new URLSearchParams(
			[...page.url.searchParams].filter(([key]) => key !== 'lang')
		).toString();
		return page.url.pathname + (search ? `?${search}` : '');
	});

	async function switchLocale(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		await fetch(form.action, { method: 'POST', body: new FormData(form, event.submitter) });
		if (page.url.searchParams.has('lang')) location.replace(backTo);
		else await invalidateAll();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>AEI · {t.product}</title>
</svelte:head>

{#snippet languageToggle()}
	<form method="POST" action={resolve('/locale')} onsubmit={switchLocale}>
		<input type="hidden" name="redirectTo" value={backTo} />
		<div role="group" aria-label={t.language} class="flex rounded-md bg-slate-100 p-0.5">
			{#each ['fi', 'en'] as const as l (l)}
				<button
					name="locale"
					value={l}
					aria-pressed={data.locale === l}
					class={[
						'min-h-8 rounded px-2.5 text-xs font-semibold tracking-wide uppercase',
						data.locale === l ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
					]}>{l}</button
				>
			{/each}
		</div>
	</form>
{/snippet}

{#if kiosk}
	{@render children()}
{:else}
	<div class="min-h-screen bg-slate-50 text-slate-900">
		<header class="border-b border-slate-200 bg-white">
			<div
				class="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-8"
			>
				<a href={resolve('/')} class="flex items-center gap-3 text-slate-900">
					<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
						<rect width="34" height="34" rx="8" fill="#0A6464" />
						<circle
							cx="17"
							cy="17"
							r="9"
							fill="none"
							stroke="#fff"
							stroke-width="2"
							opacity=".45"
						/>
						<path
							d="M17 8 A9 9 0 0 1 26 17"
							fill="none"
							stroke="#fff"
							stroke-width="2.4"
							stroke-linecap="round"
						/>
						<circle cx="17" cy="17" r="2.6" fill="#fff" />
					</svg>
					<span class="flex flex-col leading-tight">
						<span class="text-base font-bold tracking-wide">AEI</span>
						<span class="text-xs text-slate-500"
							>{t.product}
							<span class="ml-1 text-[10px] tracking-[0.08em] text-slate-400">{t.partner}</span
							></span
						>
					</span>
				</a>
				<nav aria-label={t.nav.label} class="flex flex-wrap gap-1 text-sm">
					{#each nav as item (item.route)}
						<a
							href={item.href}
							aria-current={page.route.id === item.route ? 'page' : undefined}
							class={[
								'rounded-md px-2.5 py-1.5 font-medium transition',
								page.route.id === item.route
									? 'bg-teal-50 text-teal-800'
									: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
							]}
							>{item.label}{#if item.badge && data.openAlerts.total}<span
									class={[
										'ml-1.5 inline-block min-w-[18px] rounded-full px-1.5 text-center text-[11px] leading-[18px] text-white',
										data.openAlerts.critical ? 'bg-rose-600' : 'bg-amber-800'
									]}>{data.openAlerts.total}</span
								>{/if}</a
						>
					{/each}
				</nav>
				<div class="flex-1"></div>
				<a
					href={resolve('/status')}
					class="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
					title={t.nav.status}
				>
					<span class="size-2 rounded-full bg-emerald-500"></span>
					{t.lastSync}
					<span class="font-mono text-xs text-slate-900"
						>{formatDateTime(data.locale, new Date(data.sync.loadedAt))}</span
					>
					<span class="hidden text-xs text-slate-500 2xl:inline"
						>· {t.dataUntil} {formatDate(data.locale, data.sync.lastDate)}</span
					>
				</a>
				{@render languageToggle()}
			</div>
		</header>

		<main class="mx-auto max-w-[1440px] px-4 pt-6 pb-24 sm:px-8">
			{@render children()}
		</main>
	</div>
	{#if page.route.id !== '/ask'}
		<AskChat locale={data.locale} />
	{/if}
{/if}
