export type Sex = 'F' | 'M';
export type Specimen = 'urine' | 'blood' | 'wound';
export type SirResult = 'S' | 'R';
export type Phenotype = 'esbl' | 'mrsa' | 'vre' | 'cpe';

export const PHENOTYPES: Phenotype[] = ['esbl', 'mrsa', 'vre', 'cpe'];

/** One organism found in one culture, flattened with its sample, patient and AST results. */
export interface IsolateRecord {
	isolateId: string;
	cultureId: string;
	patientId: string;
	sex: Sex;
	age: number;
	/** Patient's home area (synthetic catchment areas around the hospital: Centre, North…). */
	homeArea: string;
	/** Sample date, ISO `YYYY-MM-DD`. */
	date: string;
	ward: string;
	wardType: 'in' | 'out';
	institution: 'hospital' | 'primary_care';
	specimen: Specimen;
	organism: string;
	/** Inpatient sample taken on hospital day 3 or later (admission day = day 1). */
	hospitalOnset: boolean;
	esbl: boolean;
	mrsa: boolean;
	vre: boolean;
	cpe: boolean;
	/** AST results keyed by WHONET antibiotic code. */
	results: Partial<Record<string, SirResult>>;
}

export interface WardInfo {
	code: string;
	nameFi: string;
	nameEn: string;
	type: 'in' | 'out';
	institution: 'hospital' | 'primary_care';
}

export interface AntibioticInfo {
	code: string;
	name: string;
	nameFi: string;
	class: string;
	reportedFor: 'all' | 'urine';
}
