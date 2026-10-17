import { geoAzimuthalEqualArea, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countries50m from 'world-atlas/countries-50m.json';

export const MAP_WIDTH = 760;
export const MAP_HEIGHT = 640;

export interface CountryShape {
	/** ISO 3166-1 numeric, as in world-atlas. */
	id: string;
	name: string;
	d: string;
}

let cache: CountryShape[] | null = null;

/**
 * Europe as SVG paths, projected once on the server (Lambert azimuthal equal-area centred on
 * Europe, the ECDC map projection) so the browser receives a few path strings, not TopoJSON.
 */
export function europeShapes(): CountryShape[] {
	if (cache) return cache;
	const topology = countries50m as unknown as Topology<{
		countries: GeometryCollection<{ name: string }>;
	}>;
	const all = feature(topology, topology.objects.countries) as FeatureCollection<
		Geometry,
		{ name: string }
	>;
	const projection = geoAzimuthalEqualArea()
		.rotate([-12, -54])
		.clipExtent([
			[0, 0],
			[MAP_WIDTH, MAP_HEIGHT]
		])
		// Frame: Iceland/Portugal → Cyprus, North Cape → Malta.
		.fitExtent(
			[
				[10, 10],
				[MAP_WIDTH - 10, MAP_HEIGHT - 10]
			],
			{
				type: 'MultiPoint',
				coordinates: [
					[-24, 64],
					[-10, 36],
					[34, 34],
					[32, 71]
				]
			}
		);
	const path = geoPath(projection).digits(1);
	cache = all.features
		.map((f) => ({ id: String(f.id), name: f.properties.name, d: path(f) ?? '' }))
		.filter((c) => c.d.length > 0);
	return cache;
}
