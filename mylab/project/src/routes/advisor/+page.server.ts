import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { selectIsolates, type IsolateFilter } from '#lib/amr/antibiogram.ts';
import { detectAnomalies } from '#lib/amr/anomalies.ts';
import {
	alertWarnings,
	bestAvailable,
	bestCombination,
	coverageGaps,
	DRUG_NOTES,
	narrowestAdequate,
	organismMix,
	rankOptions
} from '#lib/amr/advisor.ts';
import { surveillanceWindows } from '#lib/amr/dates.ts';
import { MIN_ISOLATES } from '#lib/amr/stats.ts';
import type { Sex, Specimen } from '#lib/amr/types.ts';

/** Clinical syndrome → culture specimen used as evidence. */
const SITES = {
	cystitis: { label: 'Cystitis (lower UTI)', specimen: 'urine' },
	'febrile-uti': { label: 'Febrile UTI / pyelonephritis', specimen: 'urine' },
	blood: { label: 'Bloodstream infection', specimen: 'blood' },
	wound: { label: 'Skin / wound infection', specimen: 'wound' }
} as const satisfies Record<string, { label: string; specimen: Specimen }>;
type Site = keyof typeof SITES;

const AGE_GROUPS = {
	child: { label: '< 18', min: 0, max: 17 },
	adult: { label: '18–64', min: 18, max: 64 },
	elderly: { label: '≥ 65', min: 65, max: 200 }
} as const;
type AgeGroup = keyof typeof AGE_GROUPS;

const TARGETS = [0.7, 0.8, 0.9];

export const load: PageServerLoad = async ({ url }) => {
	const data = await getDataset();
	const q = url.searchParams;
	const pick = <T extends string>(key: string, allowed: readonly T[]) => {
		const v = q.get(key);
		return allowed.includes(v as T) ? (v as T) : undefined;
	};

	const ward =
		pick(
			'ward',
			data.wards.map((w) => w.code)
		) ?? 'ED';
	const site = pick('site', Object.keys(SITES) as Site[]) ?? 'cystitis';
	const specimen = SITES[site].specimen;
	const sex = pick('sex', ['F', 'M'] as Sex[]);
	const age = pick('age', Object.keys(AGE_GROUPS) as AgeGroup[]);
	const onset = pick('onset', ['hospital', 'community'] as const);
	const target = TARGETS.includes(Number(q.get('target'))) ? Number(q.get('target')) : 0.8;
	const requestedAsOf = q.get('asOf');
	const asOf =
		requestedAsOf && requestedAsOf >= data.firstDate && requestedAsOf <= data.lastDate
			? requestedAsOf
			: data.lastDate;

	const filter: IsolateFilter = {
		ward,
		specimen,
		sex,
		onset,
		ageMin: age ? AGE_GROUPS[age].min : undefined,
		ageMax: age ? AGE_GROUPS[age].max : undefined
	};
	const { recent, annual } = surveillanceWindows(asOf);

	// Fall back to all wards when the ward alone has too few isolates for this patient profile.
	let context = selectIsolates(data.isolates, filter, annual);
	const fallback = context.length < MIN_ISOLATES;
	if (fallback) context = selectIsolates(data.isolates, { ...filter, ward: undefined }, annual);
	const recentIsolates = selectIsolates(data.isolates, filter, recent);

	const wardAlerts = detectAnomalies(data.isolates, asOf).filter((a) => a.ward === ward);
	const options = rankOptions(context, recentIsolates, data.antibiotics, alertWarnings(wardAlerts));
	const lowerUtiOnly = (code: string) => DRUG_NOTES[code]?.tag === 'lower UTI only';
	const allowed = (code: string) => site === 'cystitis' || !lowerUtiOnly(code);
	const best = narrowestAdequate(options, target, allowed);
	const fallbackOption = best ? null : bestAvailable(options, allowed);
	const shown = best ?? fallbackOption;

	return {
		input: { ward, site, specimen, sex, age, onset, target, asOf },
		sites: Object.entries(SITES).map(([key, s]) => ({ key, label: s.label })),
		range: { first: data.firstDate, last: data.lastDate },
		wards: data.wards,
		ageGroups: Object.entries(AGE_GROUPS).map(([key, g]) => ({ key, label: g.label })),
		targets: TARGETS,
		antibiotics: data.antibiotics,
		notes: DRUG_NOTES,
		windows: { recent, annual },
		context: { isolates: context.length, fallback, recentIsolates: recentIsolates.length },
		organisms: organismMix(context).slice(0, 6),
		options,
		best: best?.code ?? null,
		bestAvailable: fallbackOption?.code ?? null,
		gaps: shown ? coverageGaps(context, shown.code) : [],
		combination: best ? null : bestCombination(context, options, allowed),
		unsuitable: options.filter((o) => !allowed(o.code)).map((o) => o.code),
		alerts: wardAlerts.map((a) => ({ id: a.id, severity: a.severity, kind: a.kind }))
	};
};
