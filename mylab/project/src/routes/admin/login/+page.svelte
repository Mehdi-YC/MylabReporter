<script lang="ts">
	import { messages } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const t = $derived(messages[data.locale].admin);
	const errorText = (form: string) =>
		form && formResult?.form === form
			? formResult.error === 'notAllowed'
				? t.notAllowed
				: `${t.failed}${formResult.detail ? ` (${formResult.detail})` : ''}`
			: null;
	const formResult = $derived(
		form as { form?: string; error?: string; email?: string; detail?: string } | null
	);
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-6 py-6">
	<div class="flex items-center gap-4">
		<svg width="48" height="48" viewBox="0 0 34 34" aria-hidden="true">
			<rect width="34" height="34" rx="8" fill="#0A6464" />
			<circle cx="17" cy="17" r="9" fill="none" stroke="#fff" stroke-width="2" opacity=".45" />
			<path
				d="M17 8 A9 9 0 0 1 26 17"
				fill="none"
				stroke="#fff"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
			<circle cx="17" cy="17" r="2.6" fill="#fff" />
		</svg>
		<div>
			<h1 class="text-[26px] font-semibold tracking-tight">{t.loginTitle}</h1>
			<p class="text-sm text-slate-600">{t.loginIntro}</p>
		</div>
	</div>
	{#if data.signedInAs}
		<p class="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
			{t.signedInAs(data.signedInAs)} · {t.notAllowed}
		</p>
	{/if}

	<div class="grid gap-6 md:grid-cols-2">
		<form
			method="POST"
			action="?/signIn"
			class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
		>
			<h2 class="text-lg font-semibold">{t.signIn}</h2>
			<input type="hidden" name="next" value={data.next} />
			<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
				{t.email}
				<input
					type="email"
					name="email"
					required
					autocomplete="username"
					value={formResult?.form === 'signIn' ? (formResult.email ?? '') : ''}
					class="min-h-11 rounded-md border-slate-300"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
				{t.password}
				<input
					type="password"
					name="password"
					required
					autocomplete="current-password"
					class="min-h-11 rounded-md border-slate-300"
				/>
			</label>
			{#if errorText('signIn')}<p role="alert" class="text-sm text-rose-700">
					{errorText('signIn')}
				</p>{/if}
			<button
				class="min-h-11 rounded-md bg-teal-700 px-4 font-semibold text-white hover:bg-teal-800"
				>{t.signIn}</button
			>
		</form>

		<form
			method="POST"
			action="?/signUp"
			class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
		>
			<div>
				<h2 class="text-lg font-semibold">{t.createTitle}</h2>
				<p class="text-sm text-slate-600">{t.createIntro}</p>
			</div>
			<input type="hidden" name="next" value={data.next} />
			<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
				{t.name}
				<input
					type="text"
					name="name"
					autocomplete="name"
					class="min-h-11 rounded-md border-slate-300"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
				{t.email}
				<input
					type="email"
					name="email"
					required
					autocomplete="username"
					value={formResult?.form === 'signUp' ? (formResult.email ?? '') : ''}
					class="min-h-11 rounded-md border-slate-300"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
				{t.password}
				<input
					type="password"
					name="password"
					required
					minlength="8"
					autocomplete="new-password"
					class="min-h-11 rounded-md border-slate-300"
				/>
			</label>
			{#if errorText('signUp')}<p role="alert" class="text-sm text-rose-700">
					{errorText('signUp')}
				</p>{/if}
			<button
				class="min-h-11 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-900 hover:bg-slate-50"
				>{t.create}</button
			>
		</form>
	</div>
</div>
