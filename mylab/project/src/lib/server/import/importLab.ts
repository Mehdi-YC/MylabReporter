import { and, eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '#lib/server/db/index.ts';
import {
	antibiotic,
	culture,
	isolate,
	patient,
	susceptibility,
	ward
} from '#lib/server/db/schema.ts';
import { invalidateDataset } from '#lib/server/amr/dataset.ts';
import {
	validateImport,
	type KnownKeys,
	type TableName,
	type ValidatedFile
} from '#lib/import/labCsv.ts';

export interface ImportResult {
	dryRun: boolean;
	files: (Omit<ValidatedFile, 'valid'> & { accepted: number; written: number })[];
	written: number;
	rejected: number;
	at: string;
	by: string;
}

const CHUNK = 500;
const TABLE: Record<Exclude<TableName, 'susceptibility'>, SQLiteTable> = {
	wards: ward,
	antibiotics: antibiotic,
	patients: patient,
	cultures: culture,
	isolates: isolate
};

/** Keys already in the database, so files can refer to existing patients, cultures and isolates. */
async function knownKeys(): Promise<KnownKeys> {
	const [w, a, p, c, i] = await Promise.all([
		db.select({ k: ward.code }).from(ward),
		db.select({ k: antibiotic.code }).from(antibiotic),
		db.select({ k: patient.id }).from(patient),
		db.select({ k: culture.id }).from(culture),
		db.select({ k: isolate.id }).from(isolate)
	]);
	const set = (rows: { k: string }[]) => new Set(rows.map((r) => r.k));
	return {
		wards: set(w),
		antibiotics: set(a),
		patients: set(p),
		cultures: set(c),
		isolates: set(i)
	};
}

type Executor = Pick<typeof db, 'insert'>;

/** INSERT … ON CONFLICT (primary key) DO UPDATE every other column: new rows are added, existing ones corrected. */
function upsert(executor: Executor, table: SQLiteTable, rows: Record<string, unknown>[]) {
	const columns = getTableColumns(table);
	const primary = Object.values(columns).find((c) => c.primary)!;
	const set: Record<string, SQL> = {};
	for (const [key, column] of Object.entries(columns))
		if (!column.primary) set[key] = sql.raw(`excluded."${column.name}"`);
	return executor
		.insert(table)
		.values(rows as never)
		.onConflictDoUpdate({ target: primary, set });
}

const log: ImportResult[] = [];

export function importHistory(): ImportResult[] {
	return log;
}

/**
 * Validates the uploaded files against the database and, unless `dryRun`, writes the valid rows
 * in one transaction. Susceptibility results replace any earlier result for the same isolate and
 * antibiotic. The in-memory dataset is reloaded afterwards so every page shows the new data.
 */
export async function importLabFiles(
	files: { name: string; text: string }[],
	options: { dryRun: boolean; by: string }
): Promise<ImportResult> {
	const today = new Date().toISOString().slice(0, 10);
	const validated = validateImport(files, await knownKeys(), today);

	if (!options.dryRun) {
		const order: TableName[] = [
			'wards',
			'antibiotics',
			'patients',
			'cultures',
			'isolates',
			'susceptibility'
		];
		await db.transaction(async (tx) => {
			for (const table of order) {
				for (const file of validated.filter((f) => f.table === table && f.valid.length)) {
					for (let i = 0; i < file.valid.length; i += CHUNK) {
						const chunk = file.valid.slice(i, i + CHUNK);
						if (table === 'susceptibility') {
							for (const r of chunk)
								await tx
									.delete(susceptibility)
									.where(
										and(
											eq(susceptibility.isolateId, r.isolateId as string),
											eq(susceptibility.antibioticCode, r.antibioticCode as string)
										)
									);
							await tx.insert(susceptibility).values(chunk as never);
						} else {
							await upsert(tx, TABLE[table], chunk);
						}
					}
				}
			}
		});
		invalidateDataset();
	}

	const result: ImportResult = {
		dryRun: options.dryRun,
		files: validated.map(({ valid, ...f }) => ({
			...f,
			accepted: valid.length,
			written: options.dryRun ? 0 : valid.length
		})),
		written: options.dryRun ? 0 : validated.reduce((s, f) => s + f.valid.length, 0),
		rejected: validated.reduce((s, f) => s + (f.rows - f.valid.length), 0),
		at: new Date().toISOString(),
		by: options.by
	};
	if (!options.dryRun) {
		log.unshift(result);
		log.length = Math.min(log.length, 20);
	}
	return result;
}
