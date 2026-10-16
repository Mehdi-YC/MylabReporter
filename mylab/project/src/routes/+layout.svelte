<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const nav = [
		{ label: 'Overview', route: '/', href: resolve('/') },
		{ label: 'Antibiogram', route: '/antibiogram', href: resolve('/antibiogram') },
		{ label: 'Alerts', route: '/alerts', href: resolve('/alerts') }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MyLab Reporter · AMR surveillance</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
			<a href={resolve('/')} class="flex items-center gap-2 font-semibold tracking-tight">
				<span class="grid size-8 place-items-center rounded-lg bg-teal-700 text-sm text-white"
					>AEI</span
				>
				<span>MyLab Reporter</span>
			</a>
			<nav class="flex flex-wrap gap-1 text-sm">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class={[
							'rounded-md px-3 py-1.5 transition',
							page.route.id === item.route
								? 'bg-teal-50 font-medium text-teal-800'
								: 'text-slate-600 hover:bg-slate-100'
						]}>{item.label}</a
					>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-6">
		{@render children()}
	</main>
</div>
