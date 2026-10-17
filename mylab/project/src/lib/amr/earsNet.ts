/** Country-level indicators shipped in `data/ears-net.csv` (ECDC EARS-Net). */
export const EARS_INDICATORS = {
	ecoli_3gc_resistant: {
		label: 'E. coli resistant to 3rd-generation cephalosporins',
		short: 'E. coli 3GC-R',
		description:
			'% of invasive E. coli isolates (blood, CSF) resistant to cefotaxime, ceftriaxone or ceftazidime'
	},
	saureus_mrsa: {
		label: 'MRSA among S. aureus',
		short: 'MRSA',
		description: '% of invasive S. aureus isolates that are meticillin-resistant (MRSA)'
	}
} as const;
export type EarsIndicator = keyof typeof EARS_INDICATORS;

export interface EarsRow {
	iso3: string;
	/** ISO 3166-1 numeric, matches world-atlas ids. */
	isoNumeric: string;
	country: string;
	indicator: EarsIndicator;
	year: number;
	isolates: number;
	percent: number;
	euMean: number;
	source: string;
}

/** Splits one CSV line, honouring double quotes. */
function splitCsv(line: string): string[] {
	const out: string[] = [];
	let cur = '';
	let quoted = false;
	for (const ch of line) {
		if (ch === '"') quoted = !quoted;
		else if (ch === ',' && !quoted) {
			out.push(cur);
			cur = '';
		} else cur += ch;
	}
	out.push(cur);
	return out;
}

export function parseEarsNet(text: string): EarsRow[] {
	const [header, ...lines] = text.trim().split(/\r?\n/);
	const cols = splitCsv(header);
	const at = (cells: string[], name: string) => cells[cols.indexOf(name)];
	return lines
		.filter((l) => l.trim())
		.map((l) => splitCsv(l))
		.map((c) => ({
			iso3: at(c, 'iso3'),
			isoNumeric: at(c, 'iso_numeric'),
			country: at(c, 'country'),
			indicator: at(c, 'indicator') as EarsIndicator,
			year: Number(at(c, 'year')),
			isolates: Number(at(c, 'isolates_tested')),
			percent: Number(at(c, 'percent_resistant')),
			euMean: Number(at(c, 'eu_eea_mean')),
			source: at(c, 'source')
		}))
		.filter((r) => r.indicator in EARS_INDICATORS && Number.isFinite(r.percent));
}
