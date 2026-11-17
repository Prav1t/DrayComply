// The whole database. Every table that holds customer data carries organization_id, and every
// reference between such tables includes it, so a row can never point into another organization.
import { sql } from 'drizzle-orm';
import {
  bigserial, boolean, check, customType, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`);
const org = () => uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' });

export const ROLES = ['owner', 'payroll', 'viewer'] as const;
export type Role = (typeof ROLES)[number];
export const DRIVER_CLASSES = ['DEO', 'IEO', 'IO_HOURLY', 'IO_TRIP'] as const;
export type DriverClass = (typeof DRIVER_CLASSES)[number];

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: createdAt(),
});

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),   // stored lower-case
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  activeOrganizationId: uuid('active_organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
});

export const memberships = pgTable('memberships', {
  organizationId: org(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ROLES }).notNull(),
  createdAt: createdAt(),
}, t => [primaryKey({ columns: [t.organizationId, t.userId] })]);

export const invitations = pgTable('invitations', {
  id: id(),
  organizationId: org(),
  email: text('email').notNull(),
  role: text('role', { enum: ROLES }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' }),
});

// Sign-in and sign-up attempts, for rate limiting. The key is a hash, never an address or email.
export const authAttempts = pgTable('auth_attempts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  key: text('key').notNull(),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
}, t => [index('auth_attempts_key_at').on(t.key, t.at)]);

// A null in any reported field means "not reported". It is never replaced by a default.
export const drivers = pgTable('drivers', {
  id: id(),
  organizationId: org(),
  externalId: text('external_id').notNull(),            // the driver id used in the licensee's exports
  displayName: text('display_name'),
  openingCumulativeMinutes: integer('opening_cumulative_minutes'),
  hourlyCoverageFrom: date('hourly_coverage_from', { mode: 'string' }),
  fuelBasis: text('fuel_basis', { enum: ['published', 'io_discounted'] }),
  calloutsFlagged: boolean('callouts_flagged'),
  otherLicenseeHoursReported: boolean('other_licensee_hours_reported'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
}, t => [
  unique('drivers_org_external').on(t.organizationId, t.externalId),
  unique('drivers_org_id').on(t.organizationId, t.id),
  check('drivers_opening_minutes_nonneg', sql`${t.openingCumulativeMinutes} is null or ${t.openingCumulativeMinutes} >= 0`),
]);

// Class is effective-dated; it is never a field on the driver.
export const driverClassPeriods = pgTable('driver_class_periods', {
  id: id(),
  organizationId: org(),
  driverId: uuid('driver_id').notNull(),
  class: text('class', { enum: DRIVER_CLASSES }).notNull(),
  employingIoDriverId: uuid('employing_io_driver_id'),
  fromDate: date('from_date', { mode: 'string' }).notNull(),
  toDate: date('to_date', { mode: 'string' }),
  createdAt: createdAt(),
}, t => [
  foreignKey({ name: 'class_periods_driver', columns: [t.organizationId, t.driverId], foreignColumns: [drivers.organizationId, drivers.id] }).onDelete('cascade'),
  foreignKey({ name: 'class_periods_employer', columns: [t.organizationId, t.employingIoDriverId], foreignColumns: [drivers.organizationId, drivers.id] }),
  check('class_periods_ieo_employer', sql`(${t.class} = 'IEO') = (${t.employingIoDriverId} is not null)`),
  check('class_periods_order', sql`${t.toDate} is null or ${t.toDate} >= ${t.fromDate}`),
]);

export const driverOtherHours = pgTable('driver_other_hours', {
  id: id(),
  organizationId: org(),
  driverId: uuid('driver_id').notNull(),
  workDate: date('work_date', { mode: 'string' }).notNull(),
  minutes: integer('minutes').notNull(),
  createdAt: createdAt(),
}, t => [
  foreignKey({ name: 'other_hours_driver', columns: [t.organizationId, t.driverId], foreignColumns: [drivers.organizationId, drivers.id] }).onDelete('cascade'),
  check('other_hours_minutes_positive', sql`${t.minutes} > 0`),
]);

export const datasets = pgTable('datasets', {
  id: id(),
  organizationId: org(),
  name: text('name').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: createdAt(),
}, t => [unique('datasets_org_id').on(t.organizationId, t.id)]);

// A file exactly as received, or a roster snapshot written for a run. Immutable: a corrected file is a new row.
export const uploads = pgTable('uploads', {
  id: id(),
  organizationId: org(),
  kind: text('kind', { enum: ['source', 'roster_snapshot'] }).notNull(),
  name: text('name').notNull(),
  format: text('format', { enum: ['csv', 'xlsx'] }).notNull(),
  sha256: text('sha256').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  content: bytea('content').notNull(),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  createdAt: createdAt(),
}, t => [unique('uploads_org_id').on(t.organizationId, t.id)]);

// Which upload is the current file of each name in a data set. Re-uploading repoints the row; the old upload stays.
export const datasetFiles = pgTable('dataset_files', {
  organizationId: org(),
  datasetId: uuid('dataset_id').notNull(),
  name: text('name').notNull(),
  uploadId: uuid('upload_id').notNull(),
}, t => [
  primaryKey({ columns: [t.datasetId, t.name] }),
  foreignKey({ name: 'dataset_files_dataset', columns: [t.organizationId, t.datasetId], foreignColumns: [datasets.organizationId, datasets.id] }).onDelete('cascade'),
  foreignKey({ name: 'dataset_files_upload', columns: [t.organizationId, t.uploadId], foreignColumns: [uploads.organizationId, uploads.id] }).onDelete('cascade'),
]);

// Immutable: saving a template again writes the next version.
export const mappingTemplates = pgTable('mapping_templates', {
  id: id(),
  organizationId: org(),
  templateKey: text('template_key').notNull(),
  name: text('name').notNull(),
  version: integer('version').notNull(),
  purpose: text('purpose', { enum: ['records', 'drivers'] }).notNull(),
  body: jsonb('body').notNull(),
  sha256: text('sha256').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: createdAt(),
}, t => [
  unique('templates_org_key_version').on(t.organizationId, t.templateKey, t.version),
  unique('templates_org_id').on(t.organizationId, t.id),
]);

// Immutable once written. A re-run is a new row.
export const runs = pgTable('runs', {
  id: id(),
  organizationId: org(),
  datasetId: uuid('dataset_id').notNull(),
  templateId: uuid('template_id').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: createdAt(),
  status: text('status', { enum: ['completed', 'stopped'] }).notNull(),
  asOf: date('as_of', { mode: 'string' }).notNull(),
  rounding: text('rounding').notNull(),
  periodSelection: jsonb('period_selection').notNull(),
  driverSelection: jsonb('driver_selection').notNull(),
  engineVersion: text('engine_version').notNull(),
  deductionPolicyId: text('deduction_policy_id').notNull(),
  scheduleIds: jsonb('schedule_ids').notNull(),
  unverifiedSchedulesUsed: boolean('unverified_schedules_used').notNull(),
  pendingInterpretationIds: jsonb('pending_interpretation_ids').notNull(),
  inputFiles: jsonb('input_files').notNull(),          // [{ uploadId, name, sha256, kind }]
  summary: jsonb('summary').notNull(),                 // counts for list screens; derived from the result
}, t => [
  unique('runs_org_id').on(t.organizationId, t.id),
  foreignKey({ name: 'runs_dataset', columns: [t.organizationId, t.datasetId], foreignColumns: [datasets.organizationId, datasets.id] }).onDelete('cascade'),
  foreignKey({ name: 'runs_template', columns: [t.organizationId, t.templateId], foreignColumns: [mappingTemplates.organizationId, mappingTemplates.id] }).onDelete('cascade'),
  index('runs_org_created').on(t.organizationId, t.createdAt),
]);

// Everything needed to recompute the run exactly, and what it produced.
export const runResults = pgTable('run_results', {
  runId: uuid('run_id').primaryKey(),
  organizationId: org(),
  engineInput: jsonb('engine_input'),                  // null when the run stopped before the engine
  ingest: jsonb('ingest').notNull(),
  result: jsonb('result').notNull(),
  resultSha256: text('result_sha256').notNull(),
}, t => [
  foreignKey({ name: 'run_results_run', columns: [t.organizationId, t.runId], foreignColumns: [runs.organizationId, runs.id] }).onDelete('cascade'),
]);

export const reports = pgTable('reports', {
  id: id(),
  organizationId: org(),
  runId: uuid('run_id').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'string' }).notNull(),
  sha256: text('sha256').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  watermarked: boolean('watermarked').notNull(),
  pendingLegalReview: boolean('pending_legal_review').notNull(),
  content: bytea('content').notNull(),
}, t => [
  foreignKey({ name: 'reports_run', columns: [t.organizationId, t.runId], foreignColumns: [runs.organizationId, runs.id] }).onDelete('cascade'),
]);

// Append-only. detail holds identifiers and counts, never payroll values.
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  organizationId: org(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  detail: jsonb('detail').notNull(),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
}, t => [index('audit_org_at').on(t.organizationId, t.at)]);

// Proof that an organization's data was deleted. Holds no customer data.
export const deletionReceipts = pgTable('deletion_receipts', {
  id: id(),
  organizationId: uuid('organization_id').notNull(),
  deletedByUserId: uuid('deleted_by_user_id').notNull(),
  rowCounts: jsonb('row_counts').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
});

// Tables whose rows carry customer data. The tenancy tests walk this list.
export const TENANT_TABLES = {
  memberships, invitations, drivers, driverClassPeriods, driverOtherHours, datasets, uploads, datasetFiles, mappingTemplates, runs, runResults, reports, auditLog,
} as const;

// Tables whose rows can never be changed, and can be deleted only when the whole organization is.
export const IMMUTABLE_TABLES = ['uploads', 'mapping_templates', 'runs', 'run_results', 'reports', 'audit_log'] as const;
