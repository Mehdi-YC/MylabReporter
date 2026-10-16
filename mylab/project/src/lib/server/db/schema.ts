import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

// --- Microbiology laboratory data (patients → cultures → isolates → susceptibility) ---

export const ward = sqliteTable('ward', {
	code: text('code').primaryKey(),
	nameFi: text('name_fi').notNull(),
	nameEn: text('name_en').notNull(),
	type: text('type', { enum: ['in', 'out'] }).notNull(),
	institution: text('institution', { enum: ['hospital', 'primary_care'] }).notNull()
});

export const antibiotic = sqliteTable('antibiotic', {
	code: text('code').primaryKey(),
	name: text('name').notNull(),
	nameFi: text('name_fi').notNull(),
	class: text('class').notNull(),
	reportedFor: text('reported_for', { enum: ['all', 'urine'] }).notNull()
});

export const patient = sqliteTable('patient', {
	id: text('id').primaryKey(),
	sex: text('sex', { enum: ['F', 'M'] }).notNull(),
	birthYear: integer('birth_year').notNull(),
	homeArea: text('home_area').notNull()
});

export const culture = sqliteTable(
	'culture',
	{
		id: text('id').primaryKey(),
		patientId: text('patient_id')
			.notNull()
			.references(() => patient.id),
		ageYears: integer('age_years').notNull(),
		sampleDate: text('sample_date').notNull(),
		isoYear: integer('iso_year').notNull(),
		isoWeek: integer('iso_week').notNull(),
		wardCode: text('ward_code')
			.notNull()
			.references(() => ward.code),
		admissionDate: text('admission_date'),
		specimen: text('specimen', { enum: ['urine', 'blood', 'wound'] }).notNull(),
		result: text('result', { enum: ['positive', 'negative', 'mixed_growth'] }).notNull(),
		nIsolates: integer('n_isolates').notNull()
	},
	(t) => [index('culture_date_idx').on(t.sampleDate), index('culture_ward_idx').on(t.wardCode)]
);

export const isolate = sqliteTable(
	'isolate',
	{
		id: text('id').primaryKey(),
		cultureId: text('culture_id')
			.notNull()
			.references(() => culture.id),
		isolateNo: integer('isolate_no').notNull(),
		organism: text('organism').notNull(),
		quantity: text('quantity'),
		esbl: integer('esbl', { mode: 'boolean' }).notNull(),
		mrsa: integer('mrsa', { mode: 'boolean' }).notNull(),
		vre: integer('vre', { mode: 'boolean' }).notNull(),
		cpe: integer('cpe', { mode: 'boolean' }).notNull()
	},
	(t) => [index('isolate_culture_idx').on(t.cultureId)]
);

export const susceptibility = sqliteTable(
	'susceptibility',
	{
		isolateId: text('isolate_id')
			.notNull()
			.references(() => isolate.id),
		antibioticCode: text('antibiotic_code')
			.notNull()
			.references(() => antibiotic.code),
		result: text('result', { enum: ['S', 'R'] }).notNull(),
		guideline: text('guideline').notNull()
	},
	(t) => [index('susceptibility_isolate_idx').on(t.isolateId)]
);

export * from './auth.schema';
