import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	antibiotic,
	culture,
	isolate,
	patient,
	susceptibility,
	ward
} from '#lib/server/db/schema.ts';
import { dayNumber } from '#lib/amr/dates.ts';
import type { AntibioticInfo, IsolateRecord, SirResult, WardInfo } from '#lib/amr/types.ts';

export interface Dataset {
	isolates: IsolateRecord[];
	wards: WardInfo[];
	antibiotics: AntibioticInfo[];
	organisms: string[];
	totalCultures: number;
	firstDate: string;
	/** Most recent sample date: the "today" of the laboratory feed. */
	lastDate: string;
	loadedAt: Date;
	/** Changes whenever the underlying tables change; used to invalidate the cache. */
	version: string;
}

/** How often the database is polled for new results. */
export const REFRESH_MS = 30_000;

let cache: Dataset | null = null;
let checkedAt = 0;
let pending: Promise<Dataset> | null = null;

async function currentVersion(): Promise<string> {
	const [row] = await db
		.select({
			cultures: sql<number>`count(*)`,
			last: sql<string | null>`max(${culture.sampleDate})`,
			isolates: sql<number>`(select count(*) from ${isolate})`,
			results: sql<number>`(select count(*) from ${susceptibility})`
		})
		.from(culture);
	return `${row.cultures}:${row.isolates}:${row.results}:${row.last}`;
}

async function load(version: string): Promise<Dataset> {
	const [wards, antibiotics, rows, results, totals] = await Promise.all([
		db.select().from(ward).orderBy(ward.code),
		db.select().from(antibiotic),
		db
			.select({
				isolateId: isolate.id,
				cultureId: culture.id,
				patientId: culture.patientId,
				sex: patient.sex,
				homeArea: patient.homeArea,
				age: culture.ageYears,
				date: culture.sampleDate,
				admissionDate: culture.admissionDate,
				ward: culture.wardCode,
				wardType: ward.type,
				institution: ward.institution,
				specimen: culture.specimen,
				organism: isolate.organism,
				esbl: isolate.esbl,
				mrsa: isolate.mrsa,
				vre: isolate.vre,
				cpe: isolate.cpe
			})
			.from(isolate)
			.innerJoin(culture, eq(isolate.cultureId, culture.id))
			.innerJoin(patient, eq(culture.patientId, patient.id))
			.innerJoin(ward, eq(culture.wardCode, ward.code)),
		db
			.select({
				isolateId: susceptibility.isolateId,
				code: susceptibility.antibioticCode,
				result: susceptibility.result
			})
			.from(susceptibility),
		db
			.select({
				count: sql<number>`count(*)`,
				first: sql<string>`min(${culture.sampleDate})`,
				last: sql<string>`max(${culture.sampleDate})`
			})
			.from(culture)
	]);

	const byIsolate = new Map<string, Partial<Record<string, SirResult>>>();
	for (const r of results) {
		let map = byIsolate.get(r.isolateId);
		if (!map) byIsolate.set(r.isolateId, (map = {}));
		map[r.code] = r.result;
	}

	const isolates: IsolateRecord[] = rows.map(({ admissionDate, ...r }) => ({
		...r,
		hospitalOnset:
			r.wardType === 'in' &&
			admissionDate !== null &&
			dayNumber(r.date) - dayNumber(admissionDate) >= 2,
		results: byIsolate.get(r.isolateId) ?? {}
	}));
	isolates.sort((a, b) => a.date.localeCompare(b.date) || a.isolateId.localeCompare(b.isolateId));

	const organismCounts = new Map<string, number>();
	for (const i of isolates)
		organismCounts.set(i.organism, (organismCounts.get(i.organism) ?? 0) + 1);

	return {
		isolates,
		wards,
		antibiotics,
		organisms: [...organismCounts.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o),
		totalCultures: totals[0].count,
		firstDate: totals[0].first,
		lastDate: totals[0].last,
		loadedAt: new Date(),
		version
	};
}

/**
 * Returns the in-memory dataset, reloading it when the laboratory tables have changed.
 * New results written to the database by the LIS feed show up within REFRESH_MS.
 */
export async function getDataset(): Promise<Dataset> {
	if (cache && Date.now() - checkedAt < REFRESH_MS) return cache;
	pending ??= (async () => {
		try {
			const version = await currentVersion();
			checkedAt = Date.now();
			if (!cache || cache.version !== version) cache = await load(version);
			return cache;
		} finally {
			pending = null;
		}
	})();
	return pending;
}

/** Forces the next `getDataset()` to reload, e.g. right after an import changed rows in place. */
export function invalidateDataset(): void {
	cache = null;
	checkedAt = 0;
}
