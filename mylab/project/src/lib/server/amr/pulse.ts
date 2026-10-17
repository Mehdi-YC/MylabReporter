import type { Cookies } from '@sveltejs/kit';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { rememberedWard, rememberWard } from '#lib/server/ward.ts';
import { getAlerts } from '#lib/server/amr/alerts.ts';
import { monthlyTrend, selectIsolates, type IsolateFilter } from '#lib/amr/antibiogram.ts';
import { wardLevels, type Alert } from '#lib/amr/anomalies.ts';
import {
	alertWarnings,
	DRUG_NOTES,
	empiricChoice,
	rankOptions,
	type Site
} from '#lib/amr/advisor.ts';
import { surveillanceWindows } from '#lib/amr/dates.ts';
import { firstIsolates } from '#lib/amr/firstIsolate.ts';
import { pulseTable, weeklyCounts } from '#lib/amr/pulse.ts';
import { monthlyResistance, resistanceOutlook, type Outlook } from '#lib/amr/forecast.ts';
import { explorerMatrix } from '#lib/amr/explorer.ts';
import { proportion } from '#lib/amr/stats.ts';
import { PHENOTYPES, type Specimen } from '#lib/amr/types.ts';

const SPECIMENS: Specimen[] = ['urine', 'blood', 'wound'];
const SITES_FOR: Record<
	Specimen,
	{ site: Site; key: 'cystitis' | 'febrile' | 'blood' | 'wound' }[]
> = {
	urine: [
		{ site: 'cystitis', key: 'cystitis' },
		{ site: 'febrile-uti', key: 'febrile' }
	],
	blood: [{ site: 'blood', key: 'blood' }],
	wound: [{ site: 'wound', key: 'wound' }]
};
const RANK = { critical: 0, warning: 1 };

/** Most urgent first: severity, then the strongest signal. */
const byPriority = (a: Alert, b: Alert) =>
	RANK[a.severity] - RANK[b.severity] || a.pValue - b.pValue;

/** Everything the Ward Pulse and the ward-station view show for one ward (query: ward, specimen, window, asOf). */
export async function loadWardPulse(url: URL, cookies: Cookies) {
	const data = await getDataset();
	const q = url.searchParams;
	const requestedAsOf = q.get('asOf');
	const asOf =
		requestedAsOf && requestedAsOf >= data.firstDate && requestedAsOf <= data.lastDate
			? requestedAsOf
			: data.lastDate;
	const windows = surveillanceWindows(asOf);
	const alerts = getAlerts(data, asOf).slice().sort(byPriority);

	// Default ward: the one with the most urgent alert, else the busiest.
	const wardCodes = data.wards.map((w) => w.code);
	const recentFirst = firstIsolates(
		data.isolates.filter((i) => i.date >= windows.recent.from && i.date <= windows.recent.to)
	);
	const busiest = wardCodes
		.map((code) => ({ code, n: recentFirst.filter((i) => i.ward === code).length }))
		.sort((a, b) => b.n - a.n)[0].code;
	// Ward: the URL, else the one chosen last on any page, else the most urgent alert's.
	const requestedWard = wardCodes.includes(q.get('ward') ?? '') ? q.get('ward')! : undefined;
	if (requestedWard) rememberWard(cookies, requestedWard);
	const ward = requestedWard ?? rememberedWard(cookies, wardCodes) ?? alerts[0]?.ward ?? busiest;

	// Default specimen: the ward's commonest one over 12 months.
	const wardAnnual = selectIsolates(data.isolates, { ward }, windows.annual);
	const commonest = SPECIMENS.map((s) => ({
		s,
		n: wardAnnual.filter((i) => i.specimen === s).length
	})).sort((a, b) => b.n - a.n)[0].s;
	const specimen = SPECIMENS.includes(q.get('specimen') as Specimen)
		? (q.get('specimen') as Specimen)
		: commonest;
	const view = q.get('view') === 'organism' ? 'organism' : 'ward';

	const filter: IsolateFilter = { ward, specimen };
	const table = pulseTable(data.isolates, data.antibiotics, filter, windows);
	// Window: the user's choice, else 4 weeks when the main organism has enough isolates for it
	// (n ≥ 30), else 12 months, so the table is not a wall of "too few isolates".
	const requestedWindow = q.get('window');
	const window: '4w' | '12m' =
		requestedWindow === '4w' || requestedWindow === '12m'
			? requestedWindow
			: (table.rows[0]?.recentIsolates ?? 0) >= 30
				? '4w'
				: '12m';
	const recent = selectIsolates(data.isolates, filter, windows.recent);
	const annual = selectIsolates(data.isolates, filter, windows.annual);
	const wardAlerts = alerts.filter((a) => a.ward === ward);
	const primary = wardAlerts[0] ?? null;

	// Trend: the largest rise, else the commonest organism with the first key drug it is tested for.
	const focusOrganism = table.topRise?.organism ?? table.rows[0]?.organism ?? null;
	const focusCode =
		table.topRise?.code ??
		['CRO', 'CIP', 'TMP', 'CLI', 'VAN', 'MEM'].find((c) =>
			table.rows[0]?.cells.some((cell) => cell.code === c && cell.annual.n > 0)
		) ??
		table.antibiotics[0] ??
		null;
	const trend =
		focusOrganism && focusCode
			? {
					organism: focusOrganism,
					code: focusCode,
					points: monthlyTrend(
						data.isolates,
						{ ...filter, organism: focusOrganism },
						focusCode,
						asOf,
						12
					).map((p) => ({
						month: p.month,
						r: p.share.p === null ? null : Math.round((1 - p.share.p) * 1000) / 10,
						n: p.share.n
					})),
					baseline:
						table.rows
							.find((r) => r.organism === focusOrganism)
							?.cells.find((c) => c.code === focusCode)?.annual.r ?? null
				}
			: null;

	// Weekly series behind the primary anomaly (phenotype cases), else resistant focus isolates.
	const phenotype = primary?.phenotype ?? null;
	const weekly =
		phenotype && PHENOTYPES.includes(phenotype)
			? {
					label: phenotype,
					points: weeklyCounts(
						data.isolates,
						{ ward },
						asOf,
						(list) => list.filter((i) => i[phenotype]).length
					)
				}
			: focusOrganism && focusCode
				? {
						label: 'resistant',
						points: weeklyCounts(
							data.isolates,
							{ ...filter, organism: focusOrganism },
							asOf,
							(list) => list.filter((i) => i.results[focusCode] === 'R').length
						)
					}
				: null;

	// Empiric guidance for the syndromes that use this specimen, with this ward's alerts.
	const warnings = alertWarnings(wardAlerts);
	const options = rankOptions(annual, recent, data.antibiotics, warnings);
	const empiric = SITES_FOR[specimen].map(({ site, key }) => {
		const allowed = (code: string) =>
			site === 'cystitis' || DRUG_NOTES[code]?.tag !== 'lower UTI only';
		// First-line drugs first; a reserve drug (meropenem) only as the fallback for severe cases.
		const choice = empiricChoice(options, 0.8, allowed);
		const pct = (o: { coverage: { p: number | null } } | null) =>
			o?.coverage.p === undefined || o.coverage.p === null ? null : o.coverage.p * 100;
		return {
			site,
			key,
			code: choice.pick?.code ?? null,
			coverage: pct(choice.pick),
			adequate: choice.adequate,
			reserve: choice.reserve ? { code: choice.reserve.code, coverage: pct(choice.reserve) } : null
		};
	});
	const warned = Object.keys(warnings).filter((code) => options.some((o) => o.code === code));

	// Early warning: slow month-on-month drifts over the 24 complete months before this one, per
	// cell of the table (the current month is left out, so an acute cluster does not pose as a
	// drift). Cells that already show an acute rise are left to the rise itself.
	const drift = (f: IsolateFilter, codes: string[]) => {
		const counts = monthlyResistance(data.isolates, f, codes, asOf, 25);
		return (code: string) => resistanceOutlook(counts[code].slice(0, -1));
	};
	const outlook: Record<string, Record<string, Outlook>> = {};
	for (const row of table.rows) {
		const codes = row.cells.filter((c) => c.annual.n > 0).map((c) => c.code);
		const of = drift({ ...filter, organism: row.organism }, codes);
		for (const code of codes) {
			const o = of(code);
			if (o) (outlook[row.organism] ??= {})[code] = o;
		}
	}
	// Slowly rising cells, those about to cross 20 % first, then the steepest.
	const early = table.rows
		.flatMap((row) =>
			row.cells
				.filter((c) => !c.rise && outlook[row.organism]?.[c.code]?.trend === 'rising')
				.map((c) => ({ organism: row.organism, code: c.code, ...outlook[row.organism][c.code] }))
		)
		.sort((a, b) => Number(b.warning) - Number(a.warning) || b.slope - a.slope)
		.slice(0, 3);

	// What has changed: the significant rises of the ward, largest first, in plain sentences.
	const changes = table.rows
		.flatMap((row) =>
			row.cells
				.filter((c) => c.rise && c.recent.r !== null && c.annual.r !== null)
				.map((c) => ({
					organism: row.organism,
					code: c.code,
					recent: c.recent.r!,
					annual: c.annual.r!,
					n: c.recent.n
				}))
		)
		.sort((a, b) => b.recent - b.annual - (a.recent - a.annual))
		.slice(0, 3);

	// "By organism" view: the same table turned around, one organism across every ward.
	const organism = data.organisms.includes(q.get('organism') ?? '')
		? q.get('organism')!
		: (table.rows[0]?.organism ?? data.organisms[0]);
	const tested = new Set<string>();
	for (const i of data.isolates)
		if (
			i.organism === organism &&
			i.specimen === specimen &&
			i.date >= windows.annual.from &&
			i.date <= windows.annual.to
		)
			for (const code of Object.keys(i.results)) tested.add(code);
	const organismCodes = data.antibiotics
		.filter((a) => tested.has(a.code) && a.code !== 'FOX')
		.map((a) => a.code);
	const byOrganism =
		view === 'organism'
			? explorerMatrix(data.isolates, wardCodes, organismCodes, { organism, specimen }, windows)
			: null;

	// Selected cell: ward × organism × drug, with this ward's and all wards' monthly resistance.
	const cellOrg = data.organisms.includes(q.get('cellOrg') ?? '') ? q.get('cellOrg')! : null;
	const cellAb = data.antibiotics.some((a) => a.code === q.get('cellAb')) ? q.get('cellAb')! : null;
	const resistantShare = (list: typeof annual, code: string) => {
		const tested = list.filter((i) => i.results[code] !== undefined);
		return proportion(tested.filter((i) => i.results[code] === 'R').length, tested.length);
	};
	const toR = (points: ReturnType<typeof monthlyTrend>) =>
		points.map((p) => ({
			month: p.month,
			r: p.share.p === null ? null : Math.round((1 - p.share.p) * 1000) / 10,
			n: p.share.n
		}));
	const cell =
		cellOrg && cellAb
			? (() => {
					const f = { ...filter, organism: cellOrg };
					return {
						organism: cellOrg,
						code: cellAb,
						recent: resistantShare(selectIsolates(data.isolates, f, windows.recent), cellAb),
						annual: resistantShare(selectIsolates(data.isolates, f, windows.annual), cellAb),
						ward: toR(monthlyTrend(data.isolates, f, cellAb, asOf, 24)),
						outlook: drift(f, [cellAb])(cellAb),
						hospital: toR(monthlyTrend(data.isolates, { ...f, ward: undefined }, cellAb, asOf, 24))
					};
				})()
			: null;

	const levels = wardLevels(alerts);
	return {
		asOf,
		range: { first: data.firstDate, last: data.lastDate },
		windows,
		input: { ward, specimen, window, windowAuto: !requestedWindow, view, organism },
		organisms: data.organisms,
		changes,
		outlook,
		early,
		byOrganism: byOrganism ? { codes: organismCodes, rows: byOrganism } : null,
		cell,
		wards: data.wards,
		antibiotics: data.antibiotics.map((a) => ({ code: a.code, name: a.name, nameFi: a.nameFi })),
		primary: primary
			? {
					kind: primary.kind,
					severity: primary.severity,
					phenotype: primary.phenotype ?? null,
					organism: primary.organism ?? null,
					antibiotic: primary.antibiotic ?? null,
					observed: primary.observed,
					expected: primary.expected,
					n: primary.n ?? null,
					pValue: primary.pValue,
					cases: primary.cases.length,
					investigation: primary.investigation
				}
			: null,
		wardAlerts: {
			total: wardAlerts.length,
			critical: wardAlerts.filter((a) => a.severity === 'critical').length
		},
		kpi: {
			recentIsolates: recent.length,
			annualIsolates: annual.length,
			hospitalOnset: recent.filter((i) => i.hospitalOnset).length,
			wardType: data.wards.find((w) => w.code === ward)?.type ?? 'in'
		},
		table,
		trend,
		weekly,
		empiric,
		warned,
		hospital: data.wards.map((w) => ({
			code: w.code,
			nameFi: w.nameFi,
			nameEn: w.nameEn,
			level: levels[w.code] ?? null,
			isolates: recentFirst.filter((i) => i.ward === w.code).length
		}))
	};
}
