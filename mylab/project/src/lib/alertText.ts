import type { AlertKind, Investigation, Severity } from '#lib/amr/anomalies.ts';
import type { Phenotype } from '#lib/amr/types.ts';
import { formatNumber, formatPercent, messages, type Locale } from '#lib/i18n.ts';

/** The fields of an alert the texts need (an `Alert`, or the slice a page loader sends). */
export interface AlertLike {
	kind: AlertKind;
	severity: Severity;
	ward: string;
	phenotype?: Phenotype | null;
	organism?: string | null;
	antibiotic?: string | null;
	observed: number;
	expected: number;
	n?: number | null;
	pValue: number;
	investigation: Investigation;
}

export const PHENOTYPE_LABEL: Record<Phenotype, string> = {
	esbl: 'ESBL',
	mrsa: 'MRSA',
	vre: 'VRE',
	cpe: 'CPE'
};

const decimal = (locale: Locale, x: number, digits = 1) =>
	x.toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-GB', {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits
	});

/** "p < 10⁻¹⁵" for tiny values, "p = 0,0034" otherwise. */
export function formatP(locale: Locale, p: number): string {
	if (p < 1e-15) return 'p < 10⁻¹⁵';
	if (p < 0.0001) {
		const exp = Math.floor(Math.log10(p));
		const mant = p / 10 ** exp;
		const sup = String(exp)
			.replace('-', '⁻')
			.replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
		return `p = ${decimal(locale, mant)} · 10${sup}`;
	}
	return `p = ${p.toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-GB', { maximumSignificantDigits: 2 })}`;
}

export function alertTitle(
	locale: Locale,
	a: AlertLike,
	wardName: string,
	antibioticName?: string
): string {
	const t = messages[locale].alert;
	const ph = a.phenotype ? PHENOTYPE_LABEL[a.phenotype] : '';
	switch (a.kind) {
		case 'sentinel':
			return t.titleSentinel(a.organism ? `${ph} · ${a.organism}` : ph, wardName);
		case 'phenotype-cluster':
			return t.titleCluster(ph, wardName, a.observed);
		case 'resistance-rise':
			return t.titleRise(
				a.organism ?? '',
				antibioticName ?? a.antibiotic ?? '',
				wardName,
				formatPercent(locale, a.observed * 100, 0)
			);
		case 'organism-surge':
			return t.titleSurge(a.organism ?? '', wardName, a.observed);
	}
}

/** Observation and threshold, in that order: the "why it fired" panel. */
export function alertReasons(locale: Locale, a: AlertLike): string[] {
	const t = messages[locale].alert;
	if (a.kind === 'sentinel') return [t.whySentinel];
	if (a.kind === 'resistance-rise')
		return [
			t.whyRise(
				formatPercent(locale, a.observed * 100, 0),
				a.n ?? 0,
				formatPercent(locale, a.expected * 100, 0)
			),
			`${t.ruleRise} ${formatP(locale, a.pValue)}.`
		];
	return [
		t.whyCount(a.observed, decimal(locale, a.expected)),
		`${a.kind === 'organism-surge' ? t.ruleSurge : t.ruleCluster} ${formatP(locale, a.pValue)}.`
	];
}

/** Observed / expected pair shown as figures. */
export function alertFigures(locale: Locale, a: AlertLike): { observed: string; expected: string } {
	if (a.kind === 'resistance-rise')
		return {
			observed: formatPercent(locale, a.observed * 100, 0),
			expected: formatPercent(locale, a.expected * 100, 0)
		};
	return { observed: formatNumber(locale, a.observed), expected: decimal(locale, a.expected) };
}
