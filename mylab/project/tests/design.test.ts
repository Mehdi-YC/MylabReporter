import { describe, expect, test } from 'bun:test';
import { alertTitle, formatP } from '../src/lib/alertText';
import type { Alert } from '../src/lib/amr/anomalies';
import { explorerMatrix } from '../src/lib/amr/explorer';
import { pulseTable, weeklyCounts } from '../src/lib/amr/pulse';
import { rankAlerts } from '../src/lib/amr/triage';
import type { AntibioticInfo, IsolateRecord } from '../src/lib/amr/types';
import { formatDate, formatPercent, messages } from '../src/lib/i18n';
import { makeIsolate } from './helpers';

/** Every key path of a dictionary, functions included. */
function keys(obj: unknown, prefix = ''): string[] {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
	return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
	test('Finnish and English have exactly the same keys', () => {
		expect(keys(messages.en).sort()).toEqual(keys(messages.fi).sort());
	});

	test('no English text left in the Finnish navigation', () => {
		expect(Object.values(messages.fi.nav)).not.toContain('Anomalies');
		expect(messages.fi.w4).toBe('4 viikkoa');
		expect(messages.en.w12).toBe('12 months');
	});

	test('numbers and dates follow each language', () => {
		expect(formatPercent('fi', 47.8)).toBe('47,8 %');
		expect(formatPercent('en', 47.8)).toBe('47.8%');
		expect(formatPercent('fi', null)).toBe('–');
		expect(formatDate('fi', '2025-06-30')).toBe('30.6.2025');
		expect(formatDate('en', '2025-06-30')).toBe('30 Jun 2025');
	});
});

const ab = (code: string, reportedFor: 'all' | 'urine' = 'all'): AntibioticInfo => ({
	code,
	name: code.toLowerCase(),
	nameFi: code.toLowerCase(),
	class: 'x',
	reportedFor
});
const WINDOWS = {
	recent: { from: '2026-06-03', to: '2026-06-30' },
	annual: { from: '2025-07-01', to: '2026-06-30' }
};

/** n first isolates on `date`, the first `r` resistant to CRO. */
function batch(n: number, r: number, date: string, extra: Partial<IsolateRecord> = {}) {
	return Array.from({ length: n }, (_, i) =>
		makeIsolate({
			patientId: `${date}-${extra.organism ?? 'ec'}-${extra.ward ?? 'w'}-${i}`,
			date,
			ward: 'URO',
			specimen: 'urine',
			results: { CRO: i < r ? 'R' : 'S', NIT: 'S' },
			...extra
		})
	);
}

describe('pulseTable', () => {
	// 100 E. coli over the year with 10 % CRO-R, of which 30 in the last 4 weeks with 50 % R.
	const records = [
		...batch(70, 0, '2025-12-01'),
		...batch(30, 15, '2026-06-15'),
		...batch(40, 4, '2026-01-10', { organism: 'Klebsiella pneumoniae' })
	];
	const table = pulseTable(
		records,
		[ab('CRO'), ab('NIT', 'urine'), ab('FOX'), ab('MEM')],
		{ ward: 'URO', specimen: 'urine' },
		WINDOWS
	);

	test('rows by frequency, untested and screening drugs left out', () => {
		expect(table.rows.map((r) => r.organism)).toEqual([
			'Escherichia coli',
			'Klebsiella pneumoniae'
		]);
		expect(table.antibiotics).toEqual(['CRO', 'NIT']);
	});

	test('resistance rates per window, with the significant rise flagged', () => {
		const cro = table.rows[0].cells.find((c) => c.code === 'CRO')!;
		expect(cro.recent).toEqual({ r: 50, n: 30, reliable: true });
		expect(cro.annual).toEqual({ r: 15, n: 100, reliable: true });
		expect(cro.rise).toBe(true);
		expect(table.topRise).toEqual({
			organism: 'Escherichia coli',
			code: 'CRO',
			recent: 50,
			annual: 15
		});
		expect(table.rows[1].cells.find((c) => c.code === 'CRO')!.rise).toBe(false);
	});

	test('weekly counts over 16 weeks ending at the reference date', () => {
		const weeks = weeklyCounts(
			records,
			{ ward: 'URO' },
			'2026-06-30',
			(l) => l.filter((i) => i.results.CRO === 'R').length
		);
		expect(weeks).toHaveLength(16);
		expect(weeks.at(-1)!.to).toBe('2026-06-30');
		expect(weeks.reduce((s, w) => s + w.value, 0)).toBe(15);
	});
});

describe('explorerMatrix', () => {
	test('resistant share per ward with Wilson interval, other organisms ignored', () => {
		const records = [
			...batch(40, 10, '2026-06-10'),
			...batch(10, 10, '2026-06-10', { ward: 'ICU' }),
			...batch(20, 20, '2026-06-10', { organism: 'Klebsiella pneumoniae' })
		];
		const [uro, icu] = explorerMatrix(
			records,
			['URO', 'ICU'],
			['CRO'],
			{ organism: 'Escherichia coli' },
			WINDOWS
		);
		expect(uro.cells[0].recent).toMatchObject({ k: 10, n: 40, p: 0.25, reliable: true });
		expect(uro.cells[0].recent.low).toBeLessThan(0.25);
		expect(icu.cells[0].recent).toMatchObject({ k: 10, n: 10, reliable: false });
	});
});

function alert(over: Partial<Alert>): Alert {
	return {
		id: 'x',
		kind: 'phenotype-cluster',
		severity: 'warning',
		ward: 'URO',
		observed: 3,
		expected: 1,
		pValue: 0.001,
		window: WINDOWS.recent,
		cases: [],
		investigation: {
			hospitalOnset: 0,
			sameProfile: 0,
			firstSeen: '2026-06-01',
			lastSeen: '2026-06-02'
		},
		...over
	};
}
const cases = (ids: string[]) =>
	ids.map((isolateId) => ({
		isolateId,
		date: '2026-06-10',
		patientId: isolateId,
		ward: 'URO',
		organism: 'Escherichia coli',
		specimen: 'urine' as const,
		hospitalOnset: false
	}));

describe('rankAlerts', () => {
	test('critical first, strongest first, and rises with the same patients grouped under their cluster', () => {
		const cluster = alert({
			id: 'esbl',
			severity: 'critical',
			phenotype: 'esbl',
			pValue: 1e-12,
			cases: cases(['a', 'b', 'c', 'd'])
		});
		const rise = alert({
			id: 'rise',
			kind: 'resistance-rise',
			pValue: 1e-14,
			cases: cases(['a', 'b', 'c', 'z'])
		});
		const other = alert({
			id: 'surge',
			kind: 'organism-surge',
			ward: 'ICU',
			pValue: 1e-20,
			cases: cases(['q'])
		});
		const sentinel = alert({
			id: 'cpe',
			kind: 'sentinel',
			severity: 'critical',
			phenotype: 'cpe',
			pValue: 0.4,
			cases: cases(['s'])
		});
		const ranked = rankAlerts([other, rise, sentinel, cluster]);
		expect(ranked.map((r) => r.alert.id)).toEqual(['esbl', 'rise', 'cpe', 'surge']);
		expect(ranked.map((r) => r.linkedTo)).toEqual([null, 'esbl', null, null]);
	});
});

describe('alert texts', () => {
	test('titles and p-values in both languages', () => {
		const a = alert({ phenotype: 'esbl', observed: 22, expected: 1.31 });
		expect(alertTitle('fi', a, 'Urologia')).toBe('ESBL-rypäs, Urologia: 22 tapausta 4 viikossa');
		expect(alertTitle('en', a, 'Urology')).toBe('ESBL cluster, Urology: 22 cases in 4 weeks');
		expect(formatP('en', 1e-18)).toBe('p < 10⁻¹⁵');
		expect(formatP('fi', 2.3e-5)).toBe('p = 2,3 · 10⁻⁵');
		expect(formatP('en', 0.0034)).toBe('p = 0.0034');
	});
});
