import csv from '../../../../data/ears-net.csv?raw';
import { parseEarsNet, type EarsRow } from '#lib/amr/earsNet.ts';

let rows: EarsRow[] | null = null;

/** National EARS-Net figures shipped in `data/ears-net.csv`. */
export function earsNet(): EarsRow[] {
	return (rows ??= parseEarsNet(csv));
}
