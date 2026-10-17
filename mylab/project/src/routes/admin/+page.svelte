<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatDate, formatDateTime, formatNumber, messages } from '#lib/i18n.ts';
	import type { ImportResult } from '#lib/server/import/importLab.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const t = $derived(messages[data.locale].admin);
	const num = (n: number) => formatNumber(data.locale, n);
	const result = $derived((form as { result?: ImportResult } | null)?.result ?? null);
	const formError = $derived((form as { error?: string } | null)?.error ?? null);
	let busy = $state(false);
	let selected = $state<string[]>([]);
</script>

<div class="flex flex-col gap-7">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-[28px] font-semibold tracking-tight">{t.title}</h1>
			<p class="mt-1 max-w-3xl text-sm text-slate-600">{t.intro}</p>
		</div>
		<form method="POST" action="?/signOut" class="flex items-center gap-3 text-sm text-slate-600">
			<span>{t.signedInAs(data.email)}</span>
			<button
				class="min-h-9 rounded-md border border-slate-300 bg-white px-3 font-medium hover:bg-slate-50"
				>{t.signOut}</button
			>
		</form>
	</div>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
		<section
			aria-labelledby="upload"
			class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
		>
			<h2 id="upload" class="text-[17px] font-semibold">{t.files}</h2>
			<form
				method="POST"
				action="?/import"
				enctype="multipart/form-data"
				class="flex flex-col gap-4"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update({ reset: false });
						busy = false;
					};
				}}
			>
				<label
					class="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-teal-600 hover:bg-teal-50"
				>
					<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"
						><path
							d="M12 16 V4 M7 9 L12 4 L17 9 M4 16 V20 H20 V16"
							fill="none"
							stroke="#0A6464"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
					<span class="text-sm font-medium text-slate-900">{t.files}</span>
					<span class="text-xs text-slate-500"
						>{selected.length ? selected.join(', ') : t.filesHint}</span
					>
					<input
						type="file"
						name="files"
						accept=".csv,text/csv"
						multiple
						required
						class="sr-only"
						onchange={(e) =>
							(selected = [...((e.currentTarget as HTMLInputElement).files ?? [])].map(
								(f) => f.name
							))}
					/>
				</label>
				<div class="flex flex-wrap gap-3">
					<button
						name="mode"
						value="check"
						disabled={busy}
						class="min-h-11 rounded-md border border-slate-300 bg-white px-4 font-semibold hover:bg-slate-50 disabled:opacity-50"
						>{t.check}</button
					>
					<button
						name="mode"
						value="import"
						disabled={busy}
						class="min-h-11 rounded-md bg-teal-700 px-4 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
						>{t.import}</button
					>
					{#if busy}<span class="animate-pulse self-center text-sm text-slate-500">…</span>{/if}
				</div>
				{#if formError}<p role="alert" class="text-sm text-rose-700">
						{formError === 'tooLarge' ? '> 20 MB' : t.filesHint}
					</p>{/if}
			</form>
			<p class="text-xs text-slate-500">{t.order}</p>
		</section>

		<aside class="flex flex-col gap-5">
			<section
				aria-labelledby="now"
				class="rounded-xl border border-slate-200 bg-white p-5 text-sm"
			>
				<h2 id="now" class="mb-2 font-semibold">{t.dataNow}</h2>
				<dl class="grid grid-cols-2 gap-y-1">
					<dt class="text-slate-500">{messages[data.locale].status.cultures}</dt>
					<dd class="text-right font-semibold tabular-nums">{num(data.dataset.cultures)}</dd>
					<dt class="text-slate-500">{messages[data.locale].status.isolates}</dt>
					<dd class="text-right font-semibold tabular-nums">{num(data.dataset.isolates)}</dd>
					<dt class="text-slate-500">{messages[data.locale].status.latestDay}</dt>
					<dd class="text-right font-semibold">{formatDate(data.locale, data.dataset.lastDate)}</dd>
				</dl>
				<a
					href={resolve('/status')}
					class="mt-3 inline-block font-medium text-teal-700 hover:underline">{t.openStatus} →</a
				>
			</section>
			<section
				aria-labelledby="templates"
				class="rounded-xl border border-slate-200 bg-white p-5 text-sm"
			>
				<h2 id="templates" class="mb-2 font-semibold">{t.templates}</h2>
				<ul class="grid grid-cols-2 gap-1.5">
					{#each data.tables as table (table)}
						<li>
							<a
								href={resolve('/admin/template/[table]', { table })}
								class="text-teal-700 hover:underline"
								download
								>{t.tables[table]} <span class="font-mono text-xs text-slate-500">.csv</span></a
							>
						</li>
					{/each}
				</ul>
			</section>
		</aside>
	</div>

	{#if result}
		<section aria-labelledby="result" class="rounded-xl border border-slate-200 bg-white p-6">
			<h2 id="result" class="mb-1 text-[17px] font-semibold">
				{result.dryRun ? t.checked : t.imported(num(result.written))}
				{#if result.rejected}<span class="ml-2 text-rose-700"
						>{t.rejected(num(result.rejected))}</span
					>{/if}
			</h2>
			{#if !result.dryRun}<p class="mb-3 text-sm text-emerald-700">{t.after}</p>{/if}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[640px] text-sm">
					<thead class="text-left text-xs text-slate-500">
						<tr class="border-b border-slate-200">
							<th class="py-2 font-medium">{t.colFile}</th>
							<th class="py-2 font-medium">{t.colTable}</th>
							<th class="py-2 text-right font-medium">{t.colRows}</th>
							<th class="py-2 text-right font-medium">{t.colValid}</th>
							<th class="py-2 text-right font-medium">{t.colUpdates}</th>
							<th class="py-2 text-right font-medium">{t.colErrors}</th>
						</tr>
					</thead>
					<tbody>
						{#each result.files as f (f.file)}
							<tr class="border-b border-slate-100 align-top">
								<td class="py-2 font-mono text-xs">{f.file}</td>
								<td class="py-2">{f.table ? t.tables[f.table] : t.unknownTable}</td>
								<td class="py-2 text-right tabular-nums">{num(f.rows)}</td>
								<td class="py-2 text-right tabular-nums">{num(f.accepted)}</td>
								<td class="py-2 text-right tabular-nums">{num(f.updates)}</td>
								<td
									class={[
										'py-2 text-right tabular-nums',
										f.rows - f.accepted && 'font-semibold text-rose-700'
									]}>{num(f.rows - f.accepted)}</td
								>
							</tr>
							{#if f.errors.length}
								<tr>
									<td colspan="6" class="pb-3">
										<ul
											class="max-h-48 overflow-y-auto rounded-md bg-rose-50 px-3 py-2 font-mono text-xs text-rose-900"
										>
											{#each f.errors.slice(0, 50) as e (e.line + e.message)}
												<li>{t.line} {e.line}: {e.message}</li>
											{/each}
										</ul>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<section aria-labelledby="history">
		<h2 id="history" class="mb-3 text-[17px] font-semibold">{t.history}</h2>
		{#if data.history.length}
			<ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
				{#each data.history as h (h.at)}
					<li class="flex flex-wrap justify-between gap-2 px-4 py-2.5">
						<span>{formatDateTime(data.locale, new Date(h.at))} · {h.by}</span>
						<span class="text-slate-600"
							>{t.imported(num(h.written))}{h.rejected
								? ` ${t.rejected(num(h.rejected))}`
								: ''}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-slate-500">{t.noHistory}</p>
		{/if}
	</section>
</div>
