import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TABLES, template, type TableName } from '#lib/import/labCsv.ts';

/** Header plus one example row, to fill in for an import. */
export const GET: RequestHandler = ({ params }) => {
	const table = params.table as TableName;
	if (!TABLES.includes(table)) error(404, 'Unknown table');
	return new Response(template(table), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${table}-template.csv"`
		}
	});
};
