import { getDataset } from '#lib/server/amr/dataset.ts';
import { getAlerts } from '#lib/server/amr/alerts.ts';
import { monthlyTrend, selectIsolates, type IsolateFilter } from '#lib/amr/antibiogram.ts';
import { wardLevels, type Alert } from '#lib/amr/anomalies.ts';
import {
	alertWarnings,
	bestAvailable,
	DRUG_NOTES,
	narrowestAdequate,
	rankOptions,
	type Site
} from '#lib/amr/advisor.ts';
import { surveillanceWindows } from '#lib/amr/dates.ts';
import { firstIsolates } from '#lib/amr/firstIsolate.ts';
import { pulseTable, weeklyCounts } from '#lib/amr/pulse.ts';
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
export async function loadWardPulse(url: URL) {
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
	const ward = wardCodes.includes(q.get('ward') ?? '')
		? q.get('ward')!
		: (alerts[0]?.ward ?? busiest);

	// Default specimen: the ward's commonest one over 12 months.
	const wardAnnual = selectIsolates(data.isolates, { ward }, windows.annual);
	const commonest = SPECIMENS.map((s) => ({
		s,
		n: wardAnnual.filter((i) => i.specimen === s).length
	})).sort((a, b) => b.n - a.n)[0].s;
	const specimen = SPECIMENS.includes(q.get('specimen') as Specimen)
		? (q.get('specimen') as Specimen)
		: commonest;
	const window = q.get('window') === '12m' ? '12m' : '4w';

	const filter: IsolateFilter = { ward, specimen };
	const table = pulseTable(data.isolates, data.antibiotics, filter, windows);
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
		const best = narrowestAdequate(options, 0.8, allowed);
		const fallback = best ? null : bestAvailable(options, allowed);
		const pick = best ?? fallback;
		return {
			site,
			key,
			code: pick?.code ?? null,
			coverage:
				pick?.coverage.p === undefined || pick.coverage.p === null ? null : pick.coverage.p * 100,
			adequate: !!best
		};
	});
	const warned = Object.keys(warnings).filter((code) => options.some((o) => o.code === code));

	const levels = wardLevels(alerts);
	return {
		asOf,
		range: { first: data.firstDate, last: data.lastDate },
		windows,
		input: { ward, specimen, window },
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
