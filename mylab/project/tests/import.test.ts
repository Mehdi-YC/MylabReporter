import { describe, expect, test } from 'bun:test';
import {
	COLUMNS,
	detectTable,
	isoWeek,
	parseCsv,
	template,
	TABLES,
	validateImport,
	type KnownKeys
} from '../src/lib/import/labCsv';

const known = (): KnownKeys => ({
	wards: new Set(['URO', 'ICU']),
	antibiotics: new Set(['CRO', 'MEM']),
	patients: new Set(['P1']),
	cultures: new Set(['C1']),
	isolates: new Set(['C1-1'])
});
const TODAY = '2026-10-17';
const csv = (header: string[], ...rows: string[][]) =>
	[header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

describe('parseCsv', () => {
	test('quotes, doubled quotes, CRLF, BOM and blank lines', () => {
		expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n')).toEqual([
			['a', 'b'],
			['x, y', 'say "hi"'],
			['1', '2']
		]);
	});
});

describe('detectTable', () => {
	test('recognises every table from its header, including the dataset’s extra columns', () => {
		for (const table of TABLES) expect(detectTable(COLUMNS[table])).toBe(table);
		// susceptibility.csv in the dataset also carries culture_id, organism, antibiotic…
		expect(
			detectTable([
				'isolate_id',
				'culture_id',
				'organism',
				'antibiotic',
				'antibiotic_code',
				'antibiotic_fi',
				'result',
				'guideline'
			])
		).toBe('susceptibility');
		expect(detectTable(['foo', 'bar'])).toBeNull();
	});

	test('templates are importable as they are', () => {
		for (const table of TABLES) expect(detectTable(parseCsv(template(table))[0])).toBe(table);
	});
});

describe('isoWeek', () => {
	test('ISO 8601 weeks around new year', () => {
		expect(isoWeek('2023-10-02')).toEqual({ year: 2023, week: 40 });
		expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
		expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 });
	});
});

describe('validateImport', () => {
	test('parents first: a culture can refer to a patient from another file of the same import', () => {
		const files = [
			{
				name: 'cultures.csv',
				text: csv(COLUMNS.cultures, [
					'C2',
					'P2',
					'70',
					'2026-09-28',
					'URO',
					'2026-09-25',
					'urine',
					'positive',
					'1'
				])
			},
			{ name: 'patients.csv', text: csv(COLUMNS.patients, ['P2', 'M', '1956', 'North']) }
		];
		const [cultures, patients] = validateImport(files, known(), TODAY);
		expect(patients).toMatchObject({ table: 'patients', rows: 1, updates: 0, errors: [] });
		expect(cultures.errors).toEqual([]);
		expect(cultures.valid[0]).toMatchObject({
			id: 'C2',
			patientId: 'P2',
			isoYear: 2026,
			isoWeek: 40,
			admissionDate: '2026-09-25'
		});
	});

	test('rejects bad rows with their line number and keeps the good ones', () => {
		const [file] = validateImport(
			[
				{
					name: 'susceptibility.csv',
					text: csv(
						COLUMNS.susceptibility,
						['C1-1', 'CRO', 'R', 'EUCAST 2026'],
						['C1-1', 'XXX', 'S', 'EUCAST 2026'],
						['C9-9', 'MEM', 'S', 'EUCAST 2026'],
						['C1-1', 'MEM', 'I', 'EUCAST 2026'],
						['C1-1', 'CRO', 'S', 'EUCAST 2026']
					)
				}
			],
			known(),
			TODAY
		);
		expect(file.valid).toEqual([
			{ isolateId: 'C1-1', antibioticCode: 'CRO', result: 'R', guideline: 'EUCAST 2026' }
		]);
		expect(file.errors).toEqual([
			{ line: 3, message: 'unknown antibiotic_code "XXX"' },
			{ line: 4, message: 'unknown isolate_id "C9-9"' },
			{ line: 5, message: 'result must be S or R (got "I")' },
			{ line: 6, message: 'duplicate row in this file' }
		]);
	});

	test('cultures: future dates, admission after sample, unknown ward', () => {
		const [file] = validateImport(
			[
				{
					name: 'c.csv',
					text: csv(
						COLUMNS.cultures,
						['C3', 'P1', '70', '2026-12-01', 'URO', '', 'urine', 'positive', '1'],
						['C4', 'P1', '70', '2026-09-01', 'URO', '2026-09-05', 'urine', 'positive', '1'],
						['C5', 'P1', '70', '2026-09-01', 'XYZ', '', 'urine', 'positive', '1'],
						['C1', 'P1', '70', '2026-09-01', 'ICU', '', 'blood', 'negative', '0']
					)
				}
			],
			known(),
			TODAY
		);
		expect(file.errors.map((e) => e.message)).toEqual([
			'sample_date 2026-12-01 is in the future',
			'admission_date is after sample_date',
			'unknown ward_code "XYZ"'
		]);
		// C1 already exists: it is a correction, counted as an update.
		expect(file.updates).toBe(1);
	});

	test('unrecognised files are reported, not guessed', () => {
		const [file] = validateImport([{ name: 'notes.csv', text: 'a,b\n1,2' }], known(), TODAY);
		expect(file).toMatchObject({ table: null, valid: [], errors: [{ line: 1 }] });
	});
});
