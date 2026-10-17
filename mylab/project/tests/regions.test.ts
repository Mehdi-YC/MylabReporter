import { describe, expect, test } from 'bun:test';
import { HOME_AREAS, regionalIndicator } from '../src/lib/amr/regions';
import { parseEarsNet } from '../src/lib/amr/earsNet';
import { makeIsolate } from './helpers';

const WINDOW = { from: '2026-01-01', to: '2026-12-31' };

/** n isolates in an area, the first `resistant` of them CRO-resistant. */
function area(homeArea: string, n: number, resistant: number, extra = {}) {
	return Array.from({ length: n }, (_, i) =>
		makeIsolate({
			patientId: `${homeArea}-${i}`,
			homeArea,
			date: '2026-03-01',
			results: { CRO: i < resistant ? 'R' : 'S' },
			esbl: i < resistant,
			...extra
		})
	);
}

describe('regionalIndicator', () => {
	const records = [...area('North', 40, 4), ...area('South', 10, 5), ...area('East', 30, 0)];

	test('% resistant per area, with every area listed', () => {
		const out = regionalIndicator(
			records,
			{ organism: 'Escherichia coli' },
			WINDOW,
			'resistance',
			'CRO'
		);
		expect(out.map((a) => a.area)).toEqual([...HOME_AREAS]);
		const north = out.find((a) => a.area === 'North')!;
		expect(north).toMatchObject({ isolates: 40, value: 10, reliable: true });
		expect(out.find((a) => a.area === 'West')).toMatchObject({ isolates: 0, value: null });
	});

	test('areas under 30 isolates are flagged as not reliable', () => {
		const out = regionalIndicator(records, {}, WINDOW, 'resistance', 'CRO');
		expect(out.find((a) => a.area === 'South')).toMatchObject({ value: 50, reliable: false });
		expect(out.find((a) => a.area === 'East')).toMatchObject({ value: 0, reliable: true });
	});

	test('first-isolate rule: repeat cultures of the same patient count once', () => {
		const repeats = [
			...area('Centre', 30, 0),
			// Same patient as Centre-0, resistant this time, later in the period.
			makeIsolate({
				patientId: 'Centre-0',
				homeArea: 'Centre',
				date: '2026-06-01',
				results: { CRO: 'R' }
			})
		];
		const centre = regionalIndicator(repeats, {}, WINDOW, 'resistance', 'CRO').find(
			(a) => a.area === 'Centre'
		)!;
		expect(centre).toMatchObject({ isolates: 30, value: 0 });
	});

	test('window, ward and specimen filters apply', () => {
		const mixed = [
			...area('North', 30, 30, { ward: 'URO' }),
			...area('North', 30, 0, { ward: 'ICU', patientId: undefined }).map((r, i) => ({
				...r,
				patientId: `icu-${i}`
			})),
			makeIsolate({
				patientId: 'old',
				homeArea: 'North',
				date: '2025-01-01',
				results: { CRO: 'R' }
			})
		];
		const uro = regionalIndicator(mixed, { ward: 'URO' }, WINDOW, 'resistance', 'CRO');
		expect(uro.find((a) => a.area === 'North')).toMatchObject({ isolates: 30, value: 100 });
		const all = regionalIndicator(mixed, {}, WINDOW, 'resistance', 'CRO');
		expect(all.find((a) => a.area === 'North')).toMatchObject({ isolates: 60, value: 50 });
		const blood = regionalIndicator(mixed, { specimen: 'blood' }, WINDOW, 'isolates');
		expect(blood.find((a) => a.area === 'North')!.isolates).toBe(0);
	});

	test('ESBL share, MRSA among S. aureus and plain counts', () => {
		expect(
			regionalIndicator(records, {}, WINDOW, 'esbl').find((a) => a.area === 'North')!.value
		).toBe(10);
		const sa = [
			...area('West', 20, 0, { organism: 'Staphylococcus aureus', mrsa: true }),
			...area('West', 20, 0, { organism: 'Staphylococcus aureus' }).map((r, i) => ({
				...r,
				patientId: `w2-${i}`
			}))
		];
		// The organism filter is overridden: MRSA is always among S. aureus.
		const west = regionalIndicator(
			[...records, ...sa],
			{ organism: 'Escherichia coli' },
			WINDOW,
			'mrsa'
		).find((a) => a.area === 'West')!;
		expect(west).toMatchObject({ isolates: 40, value: 50, reliable: true });
		const counts = regionalIndicator(records, {}, WINDOW, 'isolates');
		expect(counts.find((a) => a.area === 'South')).toMatchObject({ value: 10, reliable: true });
	});
});

describe('parseEarsNet', () => {
	test('reads the shipped format and ignores unknown indicators', () => {
		const rows = parseEarsNet(
			[
				'iso3,iso_numeric,country,indicator,year,isolates_tested,percent_resistant,eu_eea_mean,source',
				'FIN,246,Finland,ecoli_3gc_resistant,2024,4132,7.5,16.0,"ECDC, EARS-Net"',
				'FIN,246,Finland,unknown,2024,1,1,1,x'
			].join('\n')
		);
		expect(rows).toEqual([
			{
				iso3: 'FIN',
				isoNumeric: '246',
				country: 'Finland',
				indicator: 'ecoli_3gc_resistant',
				year: 2024,
				isolates: 4132,
				percent: 7.5,
				euMean: 16,
				source: 'ECDC, EARS-Net'
			}
		]);
	});
});
