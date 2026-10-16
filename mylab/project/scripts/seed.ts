/**
 * Loads the synthetic microbiology dataset (data/*.csv) into the database.
 *
 * Usage: bun run db:push && bun run db:seed
 *
 * The script is idempotent: it clears the lab tables before inserting, so it can be
 * re-run whenever a new extract from the laboratory information system is available.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/lib/server/db/schema.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const CHUNK = 500;

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const db = drizzle(createClient({ url }), { schema });

/** Minimal CSV reader: the extract is plain comma-separated UTF-8 without quoted fields. */
function readCsv(file: string): Record<string, string>[] {
	const [header, ...lines] = readFileSync(join(DATA_DIR, file), 'utf8')
		.split(/\r?\n/)
		.filter((line) => line.length > 0);
	const cols = header.split(',');
	return lines.map((line) => {
		const values = line.split(',');
		return Object.fromEntries(cols.map((col, i) => [col, values[i] ?? '']));
	});
}

async function insertChunked<T>(
	label: string,
	rows: T[],
	insert: (chunk: T[]) => Promise<unknown>
) {
	for (let i = 0; i < rows.length; i += CHUNK) {
		await insert(rows.slice(i, i + CHUNK));
	}
	console.log(`  ${label.padEnd(15)} ${rows.length.toLocaleString('en')} rows`);
}

const started = performance.now();
console.log('Seeding lab data from', DATA_DIR);

// Children first so foreign keys never point to deleted rows.
await db.delete(schema.susceptibility);
await db.delete(schema.isolate);
await db.delete(schema.culture);
await db.delete(schema.patient);
await db.delete(schema.antibiotic);
await db.delete(schema.ward);

await insertChunked(
	'wards',
	readCsv('wards.csv').map((r) => ({
		code: r.ward_code,
		nameFi: r.ward_fi,
		nameEn: r.ward_en,
		type: r.ward_type as 'in' | 'out',
		institution: r.institution as 'hospital' | 'primary_care'
	})),
	(c) => db.insert(schema.ward).values(c)
);

await insertChunked(
	'antibiotics',
	readCsv('antibiotics.csv').map((r) => ({
		code: r.antibiotic_code,
		name: r.antibiotic,
		nameFi: r.antibiotic_fi,
		class: r.class,
		reportedFor: r.reported_for as 'all' | 'urine'
	})),
	(c) => db.insert(schema.antibiotic).values(c)
);

await insertChunked(
	'patients',
	readCsv('patients.csv').map((r) => ({
		id: r.patient_id,
		sex: r.sex as 'F' | 'M',
		birthYear: Number(r.birth_year),
		homeArea: r.home_area
	})),
	(c) => db.insert(schema.patient).values(c)
);

await insertChunked(
	'cultures',
	readCsv('cultures.csv').map((r) => ({
		id: r.culture_id,
		patientId: r.patient_id,
		ageYears: Number(r.age_years),
		sampleDate: r.sample_date,
		isoYear: Number(r.iso_year),
		isoWeek: Number(r.iso_week),
		wardCode: r.ward_code,
		admissionDate: r.admission_date || null,
		specimen: r.specimen as 'urine' | 'blood' | 'wound',
		result: r.result as 'positive' | 'negative' | 'mixed_growth',
		nIsolates: Number(r.n_isolates)
	})),
	(c) => db.insert(schema.culture).values(c)
);

await insertChunked(
	'isolates',
	readCsv('isolates.csv').map((r) => ({
		id: r.isolate_id,
		cultureId: r.culture_id,
		isolateNo: Number(r.isolate_no),
		organism: r.organism,
		quantity: r.quantity || null,
		esbl: r.esbl === '1',
		mrsa: r.mrsa === '1',
		vre: r.vre === '1',
		cpe: r.cpe === '1'
	})),
	(c) => db.insert(schema.isolate).values(c)
);

await insertChunked(
	'susceptibility',
	readCsv('susceptibility.csv').map((r) => ({
		isolateId: r.isolate_id,
		antibioticCode: r.antibiotic_code,
		result: r.result as 'S' | 'R',
		guideline: r.guideline
	})),
	(c) => db.insert(schema.susceptibility).values(c)
);

console.log(`Done in ${((performance.now() - started) / 1000).toFixed(1)} s`);
