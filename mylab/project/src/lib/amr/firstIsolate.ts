import type { IsolateRecord } from './types';

/**
 * Keeps only the first isolate per patient, organism and specimen type (CLSI M39, THL Finres,
 * WHO GLASS). Repeat samples from the same infection would otherwise over-weight resistant,
 * hard-to-treat cases. Call it on records already restricted to the reporting period.
 */
export function firstIsolates<T extends IsolateRecord>(records: T[]): T[] {
	const sorted = [...records].sort(
		(a, b) => a.date.localeCompare(b.date) || a.isolateId.localeCompare(b.isolateId)
	);
	const seen = new Set<string>();
	const kept: T[] = [];
	for (const record of sorted) {
		const key = `${record.patientId}|${record.organism}|${record.specimen}`;
		if (seen.has(key)) continue;
		seen.add(key);
		kept.push(record);
	}
	return kept;
}
