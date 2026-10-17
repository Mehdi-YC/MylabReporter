import {
	AGE_GROUPS,
	alertWarnings,
	bestAvailable,
	bestCombination,
	DRUG_NOTES,
	narrowestAdequate,
	organismMix,
	rankOptions,
	SITES
} from '#lib/amr/advisor.ts';
import { detectAnomalies, type Alert } from '#lib/amr/anomalies.ts';
import {
	isSignificantDrop,
	monthlyTrend,
	selectIsolates,
	susceptibleShare
} from '#lib/amr/antibiogram.ts';
import { addDays, surveillanceWindows } from '#lib/amr/dates.ts';
import { MIN_ISOLATES, type Proportion } from '#lib/amr/stats.ts';
import type { AntibioticInfo, IsolateRecord, Specimen, WardInfo } from '#lib/amr/types.ts';
import type { Catalog, Intent } from './intent';

export interface AnswerData extends Catalog {
	isolates: IsolateRecord[];
}

/** One percentage as sent to the model and shown in the evidence panel. */
export interface Share {
	/** Rounded % (null when nothing was tested). */
	pct: number | null;
	n: number;
	/** n < 30: indicative only. */
	lowN?: true;
}

export interface Answer {
	intent: Intent;
	title: string;
	/** Plain-English answer built from the numbers alone; shown even when no model is available. */
	summary: string;
	/** The aggregates the answer rests on: this, and only this, is sent to the language model. */
	facts: Record<string, unknown>;
	/** Pre-filtered page that shows the same figures (the chat's "open the view" link). */
	link: { route: '/' | '/alerts' | '/advisor'; query: string; label: string };
}

const SPECIMENS: Specimen[] = ['urine', 'blood', 'wound'];
/** Agents reported first when nothing stands out (3rd-gen cephalosporin, quinolone…). */
const KEY_DRUGS = ['CRO', 'CIP', 'TZP', 'MEC', 'NIT', 'TMP', 'CLI', 'VAN', 'MEM', 'CXM', 'CAZ'];

export function share(p: Proportion): Share {
	return {
		pct: p.p === null ? null : Math.round(p.p * 100),
		n: p.n,
		...(p.n < MIN_ISOLATES ? { lowN: true as const } : {})
	};
}

const fmt = (s: Share) =>
	s.pct === null
		? 'not tested'
		: `${s.pct} % (n = ${s.n}${s.lowN ? ' only, too few to be reliable' : ''})`;
/** Spelled out both ways: small models mix up "susceptible" and "resistant". */
const fmtSR = (s: Share) =>
	s.pct === null
		? 'not tested'
		: `${100 - s.pct} % resistant / ${s.pct} % susceptible (n = ${s.n}${s.lowN ? ' only, too few to be reliable' : ''})`;

function query(params: Record<string, string | undefined>): string {
	return new URLSearchParams(
		Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)
	).toString();
}

function wardLabel(code: string | undefined, wards: WardInfo[]): string {
	if (!code) return 'all wards';
	return `${code} (${wards.find((w) => w.code === code)?.nameEn ?? code})`;
}

/** Answers the validated intent with the existing surveillance functions. Pure and deterministic. */
export function buildAnswer(intent: Intent, data: AnswerData): Answer {
	const asOf = intent.asOf ?? data.lastDate;
	if (intent.type === 'therapy') return therapyAnswer(intent, data, asOf);
	if (intent.type === 'alerts') return alertsAnswer(intent, data, asOf);
	return resistanceAnswer(intent, data, asOf);
}

function resistanceAnswer(intent: Intent, data: AnswerData, asOf: string): Answer {
	const { recent, annual } = surveillanceWindows(asOf);
	const previous = { from: addDays(annual.from, -365), to: addDays(annual.from, -1) };
	const ward = intent.ward;

	// Without an organism, take the commonest one in the ward. Without a specimen, pool all
	// specimens (more isolates) and link to the specimen where the organism is most frequent.
	const scope = selectIsolates(data.isolates, { ward, specimen: intent.specimen }, annual);
	const organism = intent.organism ?? organismMix(scope)[0]?.organism ?? data.organisms[0];
	const specimen = intent.specimen;
	const linkSpecimen =
		specimen ??
		SPECIMENS.map((s) => ({
			s,
			n: scope.filter((i) => i.organism === organism && i.specimen === s).length
		})).sort((a, b) => b.n - a.n)[0].s;

	const filter = { ward, specimen, organism };
	const annualIsolates = selectIsolates(data.isolates, filter, annual);
	const recentIsolates = selectIsolates(data.isolates, filter, recent);
	const previousIsolates = selectIsolates(data.isolates, filter, previous);

	// Urinary agents are only reported for urine samples.
	const reported = data.antibiotics.filter(
		(a) => (a.reportedFor === 'all' || specimen === 'urine') && a.code !== 'FOX'
	);
	const drugs = reported
		.map((a) => {
			const annualShare = susceptibleShare(annualIsolates, a.code);
			const recentShare = susceptibleShare(recentIsolates, a.code);
			const previousShare = susceptibleShare(previousIsolates, a.code);
			return {
				code: a.code,
				name: a.name,
				last12Months: share(annualShare),
				previous12Months: share(previousShare),
				last4Weeks: share(recentShare),
				recentDrop: isSignificantDrop(recentShare, annualShare)
			};
		})
		.filter((d) => d.last12Months.n > 0)
		.filter((d) => !intent.antibiotic || d.code === intent.antibiotic);

	const change = (d: (typeof drugs)[number]) =>
		d.last12Months.pct !== null && d.previous12Months.pct !== null && !d.previous12Months.lowN
			? d.last12Months.pct - d.previous12Months.pct
			: 0;
	// The drug that lost most ground; ties go to the agents clinicians look at first, and drugs
	// the organism is (nearly) always resistant to are not news.
	const priority = (code: string) => {
		const i = KEY_DRUGS.indexOf(code);
		return i === -1 ? KEY_DRUGS.length : i;
	};
	const focus =
		drugs.find((d) => d.code === intent.antibiotic) ??
		[...drugs]
			.filter((d) => (d.last12Months.pct ?? 0) > 5 || drugs.length === 1)
			.sort(
				(a, b) =>
					Number(b.recentDrop) - Number(a.recentDrop) ||
					change(a) - change(b) ||
					priority(a.code) - priority(b.code)
			)[0];

	const where = `${wardLabel(ward, data.wards)}, ${specimen ?? 'all specimens'}`;
	const lines = [
		`${organism}, ${where}: ${annualIsolates.length} first isolates in the last 12 months (${recentIsolates.length} in the last 4 weeks).`
	];
	if (!focus) lines.push('No susceptibility results for this selection.');
	else {
		// Stated in resistance terms with an explicit direction: small models get it wrong otherwise.
		const r = (x: Share) => (x.pct === null ? null : 100 - x.pct);
		const now = r(focus.last12Months);
		const before = r(focus.previous12Months);
		const trend =
			now === null || before === null
				? ''
				: now === before
					? ' → resistance unchanged'
					: ` → resistance ${now > before ? 'UP' : 'DOWN'} ${Math.abs(now - before)} points`;
		lines.push(
			`${focus.name}: ${fmtSR(focus.last12Months)} over the last 12 months; ${fmtSR(focus.previous12Months)} the 12 months before${trend}${focus.previous12Months.lowN || focus.last12Months.lowN ? ' (small numbers)' : ''}; last 4 weeks ${fmtSR(focus.last4Weeks)}.`
		);
		const drops = drugs.filter((d) => d.recentDrop).map((d) => d.name);
		if (drops.length) lines.push(`Significant drop in the last 4 weeks: ${drops.join(', ')}.`);
		const others = drugs
			.filter((d) => d !== focus && !intent.antibiotic)
			.map((d) => `${d.name} ${100 - (d.last12Months.pct ?? 0)} %`);
		if (others.length)
			lines.push(`Other agents, % RESISTANT over 12 months: ${others.join(', ')}.`);
	}
	// Small wards: add the hospital-wide figure for the same organism and drug as a reference.
	let hospitalWide: Share | undefined;
	if (annualIsolates.length < MIN_ISOLATES) {
		lines.push('Fewer than 30 isolates: percentages are indicative only.');
		if (ward && focus) {
			hospitalWide = share(
				susceptibleShare(
					selectIsolates(data.isolates, { ...filter, ward: undefined }, annual),
					focus.code
				)
			);
			lines.push(`All wards, same period: ${focus.name} ${fmtSR(hospitalWide)}.`);
		}
	}

	let trend: { month: string; pct: number | null; n: number }[] | undefined;
	if (focus && intent.antibiotic) {
		trend = monthlyTrend(data.isolates, filter, focus.code, asOf, 12).map((t) => ({
			month: t.month,
			pct: share(t.share).pct,
			n: t.share.n
		}));
	}

	return {
		intent: { ...intent, organism },
		title: `${organism} · ${where}`,
		summary: lines.join(' '),
		facts: {
			question: 'resistance',
			asOf,
			organism,
			ward: wardLabel(ward, data.wards),
			specimen: specimen ?? 'all',
			windows: { last4Weeks: recent, last12Months: annual, previous12Months: previous },
			firstIsolates: {
				last12Months: annualIsolates.length,
				last4Weeks: recentIsolates.length,
				previous12Months: previousIsolates.length
			},
			percentSusceptible: drugs,
			...(hospitalWide ? { allWardsLast12Months: { [focus!.name]: hospitalWide } } : {}),
			...(trend ? { monthlyPercentSusceptible: trend } : {})
		},
		// One ward: that ward's table with the organism × drug cell open. All wards: the
		// organism compared across wards.
		link: {
			route: '/',
			query: ward
				? query({
						ward,
						specimen: linkSpecimen,
						cellOrg: organism,
						cellAb: focus?.code,
						asOf: intent.asOf
					})
				: query({ view: 'organism', organism, specimen: linkSpecimen, asOf: intent.asOf }),
			label: 'Open the resistance view'
		}
	};
}

function therapyAnswer(intent: Intent, data: AnswerData, asOf: string): Answer {
	const ward = intent.ward ?? 'ED';
	const site = intent.site ?? 'febrile-uti';
	const specimen = SITES[site].specimen;
	const age = intent.age ? AGE_GROUPS[intent.age] : undefined;
	const filter = {
		ward,
		specimen,
		sex: intent.sex,
		ageMin: age?.min,
		ageMax: age?.max
	};
	const { recent, annual } = surveillanceWindows(asOf);

	let context = selectIsolates(data.isolates, filter, annual);
	const fallback = context.length < MIN_ISOLATES;
	if (fallback) context = selectIsolates(data.isolates, { ...filter, ward: undefined }, annual);
	const recentIsolates = selectIsolates(data.isolates, filter, recent);
	const wardAlerts = detectAnomalies(data.isolates, asOf).filter((a) => a.ward === ward);
	const options = rankOptions(context, recentIsolates, data.antibiotics, alertWarnings(wardAlerts));
	const allowed = (code: string) =>
		site === 'cystitis' || DRUG_NOTES[code]?.tag !== 'lower UTI only';
	const target = 0.8;
	const best = narrowestAdequate(options, target, allowed);
	const fallbackOption = best ? null : bestAvailable(options, allowed);
	const combination = best ? null : bestCombination(context, options, allowed);
	const name = (code: string) => data.antibiotics.find((a) => a.code === code)?.name ?? code;

	const profile = [
		SITES[site].label,
		intent.sex === 'F' ? 'women' : intent.sex === 'M' ? 'men' : null,
		age ? `age ${age.label}` : null
	]
		.filter(Boolean)
		.join(', ');
	const lines = [
		`${profile} in ${wardLabel(ward, data.wards)}: ${context.length} first isolates over the last 12 months${fallback ? ' (all wards: fewer than 30 in this ward)' : ''}.`
	];
	if (best)
		lines.push(
			`Narrowest agent covering at least 80 %: ${name(best.code)}, ${fmt(share(best.coverage))} of isolates susceptible.`
		);
	else {
		lines.push('No single agent reaches 80 % coverage without an active warning.');
		if (fallbackOption)
			lines.push(
				`Best single agent: ${name(fallbackOption.code)} (${fmt(share(fallbackOption.coverage))}).`
			);
		if (combination)
			lines.push(
				`Best combination: ${combination.codes.map(name).join(' + ')} (${fmt(share(combination.coverage))}).`
			);
	}
	if (wardAlerts.length)
		lines.push(`${wardAlerts.length} active alert(s) in ${ward} are taken into account.`);
	lines.push('Adjust to the culture result, allergies, renal function and local guidelines.');

	return {
		intent: { ...intent, ward, site },
		title: `Empirical therapy · ${SITES[site].label} · ${ward}`,
		summary: lines.join(' '),
		facts: {
			question: 'therapy',
			asOf,
			ward: wardLabel(ward, data.wards),
			syndrome: SITES[site].label,
			patient: { sex: intent.sex ?? 'any', age: age?.label ?? 'any' },
			firstIsolates: context.length,
			allWardsFallback: fallback,
			coverageTarget: '80 %',
			organismMix: organismMix(context)
				.slice(0, 4)
				.map((o) => ({ organism: o.organism, pct: Math.round(o.share * 100) })),
			recommended: best ? { antibiotic: name(best.code), coverage: share(best.coverage) } : null,
			bestSingleAgent: fallbackOption
				? { antibiotic: name(fallbackOption.code), coverage: share(fallbackOption.coverage) }
				: null,
			bestCombination: combination
				? { antibiotics: combination.codes.map(name), coverage: share(combination.coverage) }
				: null,
			options: options
				.filter((o) => allowed(o.code))
				.slice(0, 6)
				.map((o) => ({
					antibiotic: name(o.code),
					coverage: share(o.coverage),
					...(o.warnings.length ? { warnings: o.warnings } : {})
				})),
			activeAlerts: wardAlerts.length
		},
		link: {
			route: '/advisor',
			query: query({ ward, site, sex: intent.sex, age: intent.age, asOf: intent.asOf }),
			label: 'Open the therapy advisor'
		}
	};
}

export function describeAlert(a: Alert, antibiotics: AntibioticInfo[]): string {
	const ab = antibiotics.find((x) => x.code === a.antibiotic)?.name ?? a.antibiotic;
	switch (a.kind) {
		case 'sentinel':
			return `${a.phenotype?.toUpperCase()} sentinel case in ${a.ward}`;
		case 'phenotype-cluster':
			return `${a.phenotype?.toUpperCase()} cluster in ${a.ward}: ${a.observed} cases vs ${a.expected.toFixed(1)} expected`;
		case 'resistance-rise':
			return `${a.organism} resistant to ${ab} in ${a.ward}: ${Math.round(a.observed * 100)} % vs ${Math.round(a.expected * 100)} % baseline`;
		case 'organism-surge':
			return `${a.organism} surge in ${a.ward}: ${a.observed} isolates vs ${a.expected.toFixed(1)} expected`;
	}
}

function alertsAnswer(intent: Intent, data: AnswerData, asOf: string): Answer {
	const alerts = detectAnomalies(data.isolates, asOf).filter(
		(a) => !intent.ward || a.ward === intent.ward
	);
	const critical = alerts.filter((a) => a.severity === 'critical').length;
	const where = wardLabel(intent.ward, data.wards);
	const summary = alerts.length
		? `${alerts.length} active alert(s) in ${where} for the 4 weeks to ${asOf} (${critical} critical): ${alerts
				.map((a) => describeAlert(a, data.antibiotics))
				.join('; ')}.`
		: `No active alert in ${where} for the 4 weeks to ${asOf}.`;
	return {
		intent,
		title: `Alerts · ${where}`,
		summary,
		facts: {
			question: 'alerts',
			asOf,
			ward: where,
			alerts: alerts.map((a) => ({
				severity: a.severity,
				description: describeAlert(a, data.antibiotics),
				firstSeen: a.investigation.firstSeen,
				hospitalOnsetCases: a.investigation.hospitalOnset,
				casesWithIdenticalProfile: a.investigation.sameProfile
			}))
		},
		link: { route: '/alerts', query: query({ asOf }), label: 'Open the alerts' }
	};
}
