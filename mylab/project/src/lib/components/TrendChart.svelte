<script lang="ts">
	import type { TrendPoint } from '#lib/amr/antibiogram.ts';

	interface Props {
		selected: TrendPoint[];
		reference?: TrendPoint[] | null;
		selectedLabel: string;
		referenceLabel?: string;
		/** Points with fewer tested isolates are not drawn. */
		minN?: number;
	}

	let {
		selected,
		reference = null,
		selectedLabel,
		referenceLabel = 'All wards',
		minN = 5
	}: Props = $props();

	const W = 1160;
	const H = 260;
	const pad = { top: 12, right: 24, bottom: 28, left: 44 };
	const innerW = W - pad.left - pad.right;
	const innerH = H - pad.top - pad.bottom;

	const x = (i: number) =>
		pad.left + (selected.length > 1 ? (i / (selected.length - 1)) * innerW : 0);
	const y = (p: number) => pad.top + (1 - p) * innerH;

	function linePath(points: TrendPoint[]): string {
		let d = '';
		let pen = false;
		points.forEach((pt, i) => {
			if (pt.share.p === null || pt.share.n < minN) {
				pen = false;
				return;
			}
			d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(pt.share.p).toFixed(1)}`;
			pen = true;
		});
		return d;
	}

	const band = $derived.by(() => {
		const pts = selected
			.map((pt, i) => ({ pt, i }))
			.filter(({ pt }) => pt.share.low !== null && pt.share.n >= minN);
		if (pts.length < 2) return '';
		const upper = pts.map(({ pt, i }) => `${x(i).toFixed(1)},${y(pt.share.high!).toFixed(1)}`);
		const lower = pts
			.reverse()
			.map(({ pt, i }) => `${x(i).toFixed(1)},${y(pt.share.low!).toFixed(1)}`);
		return `M${upper.join('L')}L${lower.join('L')}Z`;
	});

	let hover = $state<number | null>(null);
</script>

<div class="overflow-x-auto">
	<svg viewBox="0 0 {W} {H}" class="w-full min-w-[520px]" role="img" aria-label="Monthly trend">
		{#each [0, 0.25, 0.5, 0.75, 1] as tick (tick)}
			<line
				x1={pad.left}
				x2={W - pad.right}
				y1={y(tick)}
				y2={y(tick)}
				class="stroke-slate-200"
				stroke-dasharray={tick === 0 || tick === 1 ? '' : '3 3'}
			/>
			<text x={pad.left - 6} y={y(tick) + 4} text-anchor="end" class="fill-slate-400 text-[12px]"
				>{tick * 100}%</text
			>
		{/each}
		{#each selected as pt, i (pt.month)}
			{#if i % 3 === 0 || i === selected.length - 1}
				<text
					x={x(i)}
					y={H - 8}
					text-anchor={i === selected.length - 1 ? 'end' : 'middle'}
					class="fill-slate-400 text-[12px]">{pt.month}</text
				>
			{/if}
		{/each}

		<path d={band} class="fill-teal-600/10" />
		{#if reference}
			<path
				d={linePath(reference)}
				class="fill-none stroke-slate-400"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
		{/if}
		<path d={linePath(selected)} class="fill-none stroke-teal-700" stroke-width="2.25" />
		{#each selected as pt, i (pt.month)}
			{#if pt.share.p !== null && pt.share.n >= minN}
				<circle cx={x(i)} cy={y(pt.share.p)} r={hover === i ? 5 : 3} class="fill-teal-700" />
			{/if}
			<rect
				x={x(i) - innerW / selected.length / 2}
				y={pad.top}
				width={innerW / selected.length}
				height={innerH}
				fill="transparent"
				role="presentation"
				onmouseenter={() => (hover = i)}
				onmouseleave={() => (hover = null)}
			/>
		{/each}
	</svg>
</div>

<div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
	<span class="flex items-center gap-2"
		><span class="h-0.5 w-5 bg-teal-700"></span>{selectedLabel} (95 % CI shaded)</span
	>
	{#if reference}
		<span class="flex items-center gap-2"
			><span class="h-0 w-5 border-t-2 border-dashed border-slate-400"></span>{referenceLabel}</span
		>
	{/if}
	{#if hover !== null}
		{@const pt = selected[hover]}
		<span class="ml-auto font-medium text-slate-800 tabular-nums">
			{pt.month}: {pt.share.p === null ? 'no isolates' : `${Math.round(pt.share.p * 100)} % S`}
			(n = {pt.share.n}){#if reference && reference[hover].share.p !== null}
				· {referenceLabel} {Math.round(reference[hover].share.p! * 100)} %{/if}
		</span>
	{/if}
</div>
