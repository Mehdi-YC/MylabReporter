import type { PageServerLoad } from './$types';
import { getDataset } from '#lib/server/amr/dataset.ts';
import { rememberedWard, rememberWard } from '#lib/server/ward.ts';
import { selectIsolates, type IsolateFilter } from '#lib/amr/antibiogram.ts';
import { detectAnomalies } from '#lib/amr/anomalies.ts';
import {
	AGE_GROUPS,
	alertWarningItems,
	alertWarnings,
	bestCombination,
	coverageGaps,
	DRUG_NOTES,
	empiricChoice,
	organismMix,
	rankOptions,
	RESERVE,
	SITES,
	type AgeGroup,
	type Site
} from '#lib/amr/advisor.ts';
import { surveillanceWindows } from '#lib/amr/dates.ts';
import { MIN_ISOLATES } from '#lib/amr/stats.ts';
import type { Sex } from '#lib/amr/types.ts';

const TARGETS = [0.7, 0.8, 0.9];

export const load: PageServerLoad = async ({ url, cookies }) => {
	const data = await getDataset();
	const q = url.searchParams;
	const pick = <T extends string>(key: string, allowed: readonly T[]) => {
		const v = q.get(key);
		return allowed.includes(v as T) ? (v as T) : undefined;
	};

	const wardCodes = data.wards.map((w) => w.code);
	const requestedWard = pick('ward', wardCodes);
	if (requestedWard) rememberWard(cookies, requestedWard);
	const ward = requestedWard ?? rememberedWard(cookies, wardCodes) ?? 'ED';
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
	// First-line drugs first; a reserve drug only as the fallback for severe cases.
	const choice = empiricChoice(options, target, allowed);
	const best = choice.adequate ? choice.pick : null;
	const fallbackOption = choice.adequate ? null : choice.pick;
	const shown = choice.pick;
	const firstLine = (code: string) => allowed(code) && !RESERVE.includes(code);

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
		// Link target for each drug's trend in the antibiogram: the commonest organism tested for it.
		trendOrganism: Object.fromEntries(
			options.map((o) => [
				o.code,
				organismMix(context.filter((i) => i.results[o.code] !== undefined))[0]?.organism ?? null
			])
		),
		options,
		best: best?.code ?? null,
		bestAvailable: fallbackOption?.code ?? null,
		reserve: choice.reserve?.code ?? null,
		warningItems: alertWarningItems(wardAlerts),
		gaps: shown ? coverageGaps(context, shown.code) : [],
		combination: best ? null : bestCombination(context, options, firstLine),
		unsuitable: options.filter((o) => !allowed(o.code)).map((o) => o.code),
		alerts: wardAlerts.map((a) => ({ id: a.id, severity: a.severity, kind: a.kind }))
	};
};
