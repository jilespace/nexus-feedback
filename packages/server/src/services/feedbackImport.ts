import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { ValidationError } from '../utils/errors.js';
import { assertProjectInOrg } from '../utils/orgScope.js';
import { getProjectCategories } from './categoryConfig.js';
import { logAudit } from './audit.js';

/** Hard limit for a single CSV import request (keeps payloads and transactions sane). */
export const MAX_IMPORT_ROWS = 500;

/** How many normalized rows the dry-run response echoes back for the preview. */
export const PREVIEW_ROW_LIMIT = 5;

export const IMPORT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ImportPriority = (typeof IMPORT_PRIORITIES)[number];

const TITLE_MAX = 200;
const CONTENT_MAX = 5000;
const CONTACT_MAX = 200;
const APP_VERSION_MAX = 50;

/** Raw row as sent by the admin client (CSV parsing happens client-side). */
export interface RawImportRow {
  title?: unknown;
  content?: unknown;
  category?: unknown;
  priority?: unknown;
  contact?: unknown;
  app_version?: unknown;
}

/** Validated + normalized row, ready to be persisted. */
export interface NormalizedImportRow {
  title: string;
  content: string;
  category: string;
  priority: ImportPriority;
  contact?: string;
  app_version?: string;
}

export interface InvalidImportRow {
  /** Zero-based data row index (header line is not counted). */
  index: number;
  errors: string[];
}

export interface ImportValidation {
  total: number;
  valid: number;
  invalid_rows: InvalidImportRow[];
  /** Normalized rows for valid entries only (internal helper payload). */
  rows: NormalizedImportRow[];
}

export interface ImportPreview {
  total: number;
  valid: number;
  invalid_rows: InvalidImportRow[];
  preview: NormalizedImportRow[];
}

export interface ImportCommitResult {
  total: number;
  valid: number;
  imported: number;
  invalid_rows: InvalidImportRow[];
}

export interface ImportParams {
  orgId: string;
  projectId: string;
  rows: RawImportRow[];
  memberId?: string;
}

function sanitizeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPriority(value: string): value is ImportPriority {
  return (IMPORT_PRIORITIES as readonly string[]).includes(value);
}

function validateRow(
  row: RawImportRow,
  index: number,
  categories: Set<string>,
): { errors: string[]; normalized?: NormalizedImportRow } {
  const errors: string[] = [];

  const title = asTrimmedString(row.title);
  if (!title) errors.push('标题不能为空');
  else if (title.length > TITLE_MAX) errors.push(`标题不能超过 ${TITLE_MAX} 个字符`);

  const content = asTrimmedString(row.content);
  if (!content) errors.push('内容不能为空');
  else if (content.length > CONTENT_MAX) errors.push(`内容不能超过 ${CONTENT_MAX} 个字符`);

  const category = asTrimmedString(row.category);
  if (!category) errors.push('分类不能为空');
  else if (!categories.has(category)) errors.push(`无效的分类: ${category}`);

  const rawPriority = asTrimmedString(row.priority);
  const priority = rawPriority || 'medium';
  if (!isPriority(priority)) errors.push(`无效的优先级: ${rawPriority}`);

  const contact = asTrimmedString(row.contact);
  if (contact.length > CONTACT_MAX) errors.push(`联系方式不能超过 ${CONTACT_MAX} 个字符`);

  const appVersion = asTrimmedString(row.app_version);
  if (appVersion.length > APP_VERSION_MAX) {
    errors.push(`版本号不能超过 ${APP_VERSION_MAX} 个字符`);
  }

  if (errors.length > 0) return { errors };

  return {
    errors,
    normalized: {
      title: sanitizeHtml(title),
      content: sanitizeHtml(content),
      category,
      priority: priority as ImportPriority,
      ...(contact ? { contact } : {}),
      ...(appVersion ? { app_version: appVersion } : {}),
    },
  };
}

/**
 * Validate an import payload without touching the database.
 *
 * - Enforces the 1..500 row window and that the project belongs to the org.
 * - Category is checked against the project's configured categories (the same
 *   list used by feedback creation), priority against the fixed enum.
 * - Rows that fail collect a list of human readable errors; indexes are
 *   zero-based data-row positions so the client can map them back to CSV lines.
 */
export async function validateFeedbackImport(params: ImportParams): Promise<ImportValidation> {
  const { orgId, projectId, rows } = params;

  if (!projectId) throw new ValidationError('缺少项目 ID');
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError('导入数据不能为空');
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(`单次最多导入 ${MAX_IMPORT_ROWS} 条反馈`);
  }

  await assertProjectInOrg(orgId, projectId);
  const categories = new Set(await getProjectCategories(projectId));

  const invalid_rows: InvalidImportRow[] = [];
  const validRows: NormalizedImportRow[] = [];
  rows.forEach((row, index) => {
    const { errors, normalized } = validateRow(row ?? {}, index, categories);
    if (errors.length > 0 || !normalized) {
      invalid_rows.push({ index, errors: errors.length > 0 ? errors : ['数据格式错误'] });
      return;
    }
    validRows.push(normalized);
  });

  return {
    total: rows.length,
    valid: validRows.length,
    invalid_rows,
    rows: validRows,
  };
}

/**
 * Dry-run: validate and return the per-row errors plus a small normalized preview.
 * Never writes to the database.
 */
export async function previewFeedbackImport(params: ImportParams): Promise<ImportPreview> {
  const result = await validateFeedbackImport(params);
  return {
    total: result.total,
    valid: result.valid,
    invalid_rows: result.invalid_rows,
    preview: result.rows.slice(0, PREVIEW_ROW_LIMIT),
  };
}

/**
 * Commit an import.
 *
 * Validation runs first for the whole payload; if any row is invalid nothing is
 * written and the caller receives the `invalid_rows` report (the route responds
 * with HTTP 400). When everything is valid the rows are inserted in one
 * `createMany` with `source = 'import'`, followed by a single audit log entry.
 */
export async function commitFeedbackImport(params: ImportParams): Promise<ImportCommitResult> {
  const result = await validateFeedbackImport(params);

  if (result.invalid_rows.length > 0) {
    return {
      total: result.total,
      valid: result.valid,
      imported: 0,
      invalid_rows: result.invalid_rows,
    };
  }

  const data: Prisma.FeedbackCreateManyInput[] = result.rows.map((row) => ({
    title: row.title,
    content: row.content,
    category: row.category,
    priority: row.priority,
    contact: row.contact,
    app_version: row.app_version,
    project_id: params.projectId,
    source: 'import',
  }));

  const created = await prisma.feedback.createMany({ data });

  // Auditing must not roll back a successful import.
  await logAudit({
    orgId: params.orgId,
    memberId: params.memberId,
    action: 'feedback.import',
    targetType: 'project',
    targetId: params.projectId,
    metadata: { count: created.count, project_id: params.projectId },
  }).catch(() => undefined);

  return {
    total: result.total,
    valid: result.valid,
    imported: created.count,
    invalid_rows: [],
  };
}
