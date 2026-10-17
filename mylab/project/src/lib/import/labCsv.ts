/**
 * Laboratory extract import: CSV parsing and row validation, independent of the database so it can
 * be unit-tested. Files use the same columns as `data/*.csv` (see data/README.md).
 */

export const TABLES = [
	'wards',
	'antibiotics',
	'patients',
	'cultures',
	'isolates',
	'susceptibility'
] as const;
export type TableName = (typeof TABLES)[number];

/** Required columns per table: a file is recognised by its header. */
export const COLUMNS: Record<TableName, string[]> = {
	wards: ['ward_code', 'ward_fi', 'ward_en', 'ward_type', 'institution'],
	antibiotics: ['antibiotic', 'antibiotic_code', 'antibiotic_fi', 'class', 'reported_for'],
	patients: ['patient_id', 'sex', 'birth_year', 'home_area'],
	cultures: [
		'culture_id',
		'patient_id',
		'age_years',
		'sample_date',
		'ward_code',
		'admission_date',
		'specimen',
		'result',
		'n_isolates'
	],
	isolates: ['isolate_id', 'culture_id', 'isolate_no', 'organism', 'esbl', 'mrsa', 'vre', 'cpe'],
	susceptibility: ['isolate_id', 'antibiotic_code', 'result', 'guideline']
};

/** One example row per table, for the downloadable templates (synthetic values). */
export const EXAMPLES: Record<TableName, string[]> = {
	wards: ['URO', 'Urologia', 'Urology', 'in', 'hospital'],
	antibiotics: ['ceftriaxone', 'CRO', 'keftriaksoni', 'cephalosporins 3rd gen', 'all'],
	patients: ['P010001', 'F', '1950', 'Centre'],
	cultures: [
		'C0100001',
		'P010001',
		'75',
		'2026-09-28',
		'URO',
		'2026-09-25',
		'urine',
		'positive',
		'1'
	],
	isolates: ['C0100001-1', 'C0100001', '1', 'Escherichia coli', '0', '0', '0', '0'],
	susceptibility: ['C0100001-1', 'CRO', 'S', 'EUCAST 2026']
};

/** Keys already in the database (or added by an earlier file of the same import). */
export interface KnownKeys {
	wards: Set<string>;
	antibiotics: Set<string>;
	patients: Set<string>;
	cultures: Set<string>;
	isolates: Set<string>;
}

export interface RowError {
	/** 1-based line in the file (header = line 1). */
	line: number;
	message: string;
}

export interface ValidatedFile {
	file: string;
	table: TableName | null;
	rows: number;
	/** Rows ready to write, mapped to database columns. */
	valid: Record<string, unknown>[];
	/** Keys of valid rows that already exist (will be updated rather than added). */
	updates: number;
	errors: RowError[];
}

/** RFC 4180-style CSV: quoted fields, doubled quotes, CRLF or LF, optional BOM. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const s = text.replace(/^\uFEFF/, '');
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (quoted) {
			if (ch === '"' && s[i + 1] === '"') {
				field += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else field += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && s[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			if (row.some((v) => v !== '')) rows.push(row);
			row = [];
		} else field += ch;
	}
	row.push(field);
	if (row.some((v) => v !== '')) rows.push(row);
	return rows;
}

export function detectTable(header: string[]): TableName | null {
	const cols = new Set(header.map((h) => h.trim()));
	// Most specific first: susceptibility and isolates share isolate_id.
	const order: TableName[] = [
		'susceptibility',
		'isolates',
		'cultures',
		'patients',
		'antibiotics',
		'wards'
	];
	return order.find((t) => COLUMNS[t].every((c) => cols.has(c))) ?? null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: string) => ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const int = (v: string) => (/^-?\d+$/.test(v.trim()) ? Number(v) : NaN);
const flag = (v: string) =>
	v === '1' || v.toLowerCase() === 'true'
		? true
		: v === '0' || v.toLowerCase() === 'false'
			? false
			: null;

/** ISO year and week of a date (weeks start on Monday; week 1 contains the first Thursday). */
export function isoWeek(iso: string): { year: number; week: number } {
	const d = new Date(`${iso}T00:00:00Z`);
	// Move to the Thursday of the same week: its year is the ISO year.
	d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
	const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
	return {
		year: d.getUTCFullYear(),
		week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
	};
}

type Check = (r: Record<string, string>, known: KnownKeys, today: string) => string | null;
type Mapper = (r: Record<string, string>) => Record<string, unknown>;

const SPEC: Record<
	TableName,
	{
		key: (r: Record<string, string>) => string;
		keySet?: keyof KnownKeys;
		check: Check;
		map: Mapper;
	}
> = {
	wards: {
		key: (r) => r.ward_code,
		keySet: 'wards',
		check: (r) =>
			!r.ward_code
				? 'ward_code is empty'
				: !['in', 'out'].includes(r.ward_type)
					? `ward_type must be in or out (got "${r.ward_type}")`
					: !['hospital', 'primary_care'].includes(r.institution)
						? `institution must be hospital or primary_care (got "${r.institution}")`
						: null,
		map: (r) => ({
			code: r.ward_code,
			nameFi: r.ward_fi,
			nameEn: r.ward_en,
			type: r.ward_type,
			institution: r.institution
		})
	},
	antibiotics: {
		key: (r) => r.antibiotic_code,
		keySet: 'antibiotics',
		check: (r) =>
			!r.antibiotic_code
				? 'antibiotic_code is empty'
				: !['all', 'urine'].includes(r.reported_for)
					? `reported_for must be all or urine (got "${r.reported_for}")`
					: null,
		map: (r) => ({
			code: r.antibiotic_code,
			name: r.antibiotic,
			nameFi: r.antibiotic_fi,
			class: r.class,
			reportedFor: r.reported_for
		})
	},
	patients: {
		key: (r) => r.patient_id,
		keySet: 'patients',
		check: (r, _k, today) => {
			const year = int(r.birth_year);
			return !r.patient_id
				? 'patient_id is empty'
				: !['F', 'M'].includes(r.sex)
					? `sex must be F or M (got "${r.sex}")`
					: !(year >= 1900 && year <= Number(today.slice(0, 4)))
						? `birth_year is not a valid year (got "${r.birth_year}")`
						: !r.home_area
							? 'home_area is empty'
							: null;
		},
		map: (r) => ({
			id: r.patient_id,
			sex: r.sex,
			birthYear: int(r.birth_year),
			homeArea: r.home_area
		})
	},
	cultures: {
		key: (r) => r.culture_id,
		keySet: 'cultures',
		check: (r, known, today) => {
			const age = int(r.age_years);
			return !r.culture_id
				? 'culture_id is empty'
				: !known.patients.has(r.patient_id)
					? `unknown patient_id "${r.patient_id}"`
					: !known.wards.has(r.ward_code)
						? `unknown ward_code "${r.ward_code}"`
						: !isDate(r.sample_date)
							? `sample_date must be YYYY-MM-DD (got "${r.sample_date}")`
							: r.sample_date > today
								? `sample_date ${r.sample_date} is in the future`
								: r.admission_date && !isDate(r.admission_date)
									? `admission_date must be empty or YYYY-MM-DD (got "${r.admission_date}")`
									: r.admission_date && r.admission_date > r.sample_date
										? 'admission_date is after sample_date'
										: !['urine', 'blood', 'wound'].includes(r.specimen)
											? `specimen must be urine, blood or wound (got "${r.specimen}")`
											: !['positive', 'negative', 'mixed_growth'].includes(r.result)
												? `result must be positive, negative or mixed_growth (got "${r.result}")`
												: !(age >= 0 && age <= 120)
													? `age_years is not a valid age (got "${r.age_years}")`
													: Number.isNaN(int(r.n_isolates))
														? `n_isolates is not a number (got "${r.n_isolates}")`
														: null;
		},
		map: (r) => {
			// ISO year / week are derived from the sample date when the file does not carry them.
			const w = isoWeek(r.sample_date);
			return {
				id: r.culture_id,
				patientId: r.patient_id,
				ageYears: int(r.age_years),
				sampleDate: r.sample_date,
				isoYear: r.iso_year ? int(r.iso_year) : w.year,
				isoWeek: r.iso_week ? int(r.iso_week) : w.week,
				wardCode: r.ward_code,
				admissionDate: r.admission_date || null,
				specimen: r.specimen,
				result: r.result,
				nIsolates: int(r.n_isolates)
			};
		}
	},
	isolates: {
		key: (r) => r.isolate_id,
		keySet: 'isolates',
		check: (r, known) =>
			!r.isolate_id
				? 'isolate_id is empty'
				: !known.cultures.has(r.culture_id)
					? `unknown culture_id "${r.culture_id}"`
					: Number.isNaN(int(r.isolate_no))
						? `isolate_no is not a number (got "${r.isolate_no}")`
						: !r.organism
							? 'organism is empty'
							: ['esbl', 'mrsa', 'vre', 'cpe'].some((c) => flag(r[c]) === null)
								? 'esbl, mrsa, vre and cpe must be 0 or 1'
								: null,
		map: (r) => ({
			id: r.isolate_id,
			cultureId: r.culture_id,
			isolateNo: int(r.isolate_no),
			organism: r.organism,
			quantity: r.quantity || null,
			esbl: flag(r.esbl),
			mrsa: flag(r.mrsa),
			vre: flag(r.vre),
			cpe: flag(r.cpe)
		})
	},
	susceptibility: {
		key: (r) => `${r.isolate_id}|${r.antibiotic_code}`,
		check: (r, known) =>
			!known.isolates.has(r.isolate_id)
				? `unknown isolate_id "${r.isolate_id}"`
				: !known.antibiotics.has(r.antibiotic_code)
					? `unknown antibiotic_code "${r.antibiotic_code}"`
					: !['S', 'R'].includes(r.result)
						? `result must be S or R (got "${r.result}")`
						: !r.guideline
							? 'guideline is empty'
							: null,
		map: (r) => ({
			isolateId: r.isolate_id,
			antibioticCode: r.antibiotic_code,
			result: r.result,
			guideline: r.guideline
		})
	}
};

/**
 * Validates every file of one import. Files are processed parents first (wards … susceptibility)
 * so a new culture can refer to a patient added by another file of the same upload. Mutates
 * `known` with the keys of valid rows.
 */
export function validateImport(
	files: { name: string; text: string }[],
	known: KnownKeys,
	today: string
): ValidatedFile[] {
	const parsed = files.map((f) => {
		const rows = parseCsv(f.text);
		const header = (rows[0] ?? []).map((h) => h.trim());
		return { name: f.name, header, body: rows.slice(1), table: detectTable(header) };
	});
	const rank = (t: TableName | null) => (t === null ? 99 : TABLES.indexOf(t));
	const results = new Map<string, ValidatedFile>();

	for (const f of [...parsed].sort((a, b) => rank(a.table) - rank(b.table))) {
		const result: ValidatedFile = {
			file: f.name,
			table: f.table,
			rows: f.body.length,
			valid: [],
			updates: 0,
			errors: []
		};
		results.set(f.name, result);
		if (!f.table) {
			result.errors.push({
				line: 1,
				message: 'Unrecognised header: not one of the laboratory extract tables'
			});
			continue;
		}
		const spec = SPEC[f.table];
		const seen = new Set<string>();
		f.body.forEach((values, i) => {
			const line = i + 2;
			const r = Object.fromEntries(f.header.map((h, j) => [h, (values[j] ?? '').trim()]));
			const key = spec.key(r);
			const problem = seen.has(key) ? 'duplicate row in this file' : spec.check(r, known, today);
			if (problem) {
				if (result.errors.length < 200) result.errors.push({ line, message: problem });
				return;
			}
			seen.add(key);
			if (spec.keySet) {
				if (known[spec.keySet].has(key)) result.updates++;
				else known[spec.keySet].add(key);
			}
			result.valid.push(spec.map(r));
		});
	}
	return files.map((f) => results.get(f.name)!);
}

/** A downloadable template: header and one example row. */
export function template(table: TableName): string {
	return `${COLUMNS[table].join(',')}\n${EXAMPLES[table].join(',')}\n`;
}
