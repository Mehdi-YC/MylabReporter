import type { IsolateRecord } from '../src/lib/amr/types';

let counter = 0;

/** Builds an isolate record with sensible defaults for tests. */
export function makeIsolate(overrides: Partial<IsolateRecord> = {}): IsolateRecord {
	counter++;
	return {
		isolateId: `I${String(counter).padStart(6, '0')}`,
		cultureId: `C${String(counter).padStart(6, '0')}`,
		patientId: 'P1',
		sex: 'F',
		age: 60,
		date: '2026-01-01',
		ward: 'MED-A',
		wardType: 'in',
		institution: 'hospital',
		specimen: 'urine',
		organism: 'Escherichia coli',
		hospitalOnset: false,
		esbl: false,
		mrsa: false,
		vre: false,
		cpe: false,
		results: {},
		...overrides
	};
}
