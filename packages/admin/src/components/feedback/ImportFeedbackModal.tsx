import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { Modal } from '@/components/Modal';
import { Badge, Button, Field, settingsInputClass } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { CATEGORY_OPTIONS, categoryColor, priorityLabel } from '@/utils/labels';
import type { CategoryConfig, FeedbackPriority, ProjectAccessInfo } from '@/types';

const MAX_ROWS = 500;
const PREVIEW_LIMIT = 20;
const REQUIRED_COLUMNS = ['title', 'content', 'category'] as const;
const OPTIONAL_COLUMNS = ['priority', 'contact', 'app_version'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const inputClass = settingsInputClass();

type ImportCsvT = TFunction<'importCsv'>;

interface ServerInvalidRow {
  index: number;
  errors: string[];
}

interface ImportResponse {
  total: number;
  valid: number;
  imported?: number;
  invalid_rows: ServerInvalidRow[];
}

interface PreviewRow {
  /** Zero-based data row index (header excluded), matches server invalid_rows. */
  index: number;
  /** 1-based physical line in the pasted CSV, for user-facing messages. */
  line: number;
  title: string;
  content: string;
  category: string;
  priority: string;
  contact: string;
  appVersion: string;
  errors: string[];
}

interface ParsedCsv {
  headerError: string | null;
  rows: PreviewRow[];
  total: number;
  valid: number;
  invalid: number;
}

const EMPTY_PARSED: ParsedCsv = {
  headerError: null,
  rows: [],
  total: 0,
  valid: 0,
  invalid: 0,
};

/**
 * The server validates imports with Chinese messages only. Known messages are
 * mapped back to `importCsv.errors.*` so the English UI stays consistent; an
 * unknown message falls through verbatim instead of hiding information.
 */
const SERVER_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  key: string;
  params?: (match: RegExpMatchArray) => Record<string, unknown>;
}> = [
  { pattern: /^标题不能为空$/, key: 'errors.titleRequired' },
  {
    pattern: /^标题不能超过 (\d+) 个字符$/,
    key: 'errors.titleTooLong',
    params: (match) => ({ max: match[1] }),
  },
  { pattern: /^内容不能为空$/, key: 'errors.contentRequired' },
  {
    pattern: /^内容不能超过 (\d+) 个字符$/,
    key: 'errors.contentTooLong',
    params: (match) => ({ max: match[1] }),
  },
  { pattern: /^分类不能为空$/, key: 'errors.categoryRequired' },
  {
    pattern: /^无效的分类:\s*(.+)$/,
    key: 'errors.categoryInvalid',
    params: (match) => ({ value: match[1] }),
  },
  {
    pattern: /^无效的优先级:\s*(.+)$/,
    key: 'errors.priorityInvalid',
    params: (match) => ({ value: match[1] }),
  },
  {
    pattern: /^联系方式不能超过 (\d+) 个字符$/,
    key: 'errors.contactTooLong',
    params: (match) => ({ max: match[1] }),
  },
  {
    pattern: /^版本号不能超过 (\d+) 个字符$/,
    key: 'errors.versionTooLong',
    params: (match) => ({ max: match[1] }),
  },
  { pattern: /^导入数据不能为空$/, key: 'errors.emptyRows' },
  {
    pattern: /^单次最多导入 (\d+) 条反馈$/,
    key: 'errors.tooManyRowsMax',
    params: (match) => ({ max: match[1] }),
  },
  { pattern: /^缺少项目 ID$/, key: 'errors.missingProject' },
  { pattern: /^导入数据格式错误$/, key: 'errors.invalidPayload' },
  { pattern: /^项目不存在$/, key: 'errors.projectNotFound' },
];

function translateServerMessage(message: string, t: ImportCsvT): string {
  for (const { pattern, key, params } of SERVER_ERROR_PATTERNS) {
    const match = message.match(pattern);
    if (match) return t(key, params?.(match));
  }
  return message;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Minimal RFC 4180 reader: comma separated, double quotes with "" escaping,
 * CRLF/LF tolerant, keeps physical line numbers so errors point at the pasted
 * text. Blank lines are ignored.
 */
function parseCsv(text: string): Array<{ line: number; cells: string[] }> {
  const clean = text.replace(/^\uFEFF/, '');
  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line += 1;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(field);
      field = '';
    } else if (ch === '\n') {
      cells.push(field);
      records.push({ line: recordLine, cells });
      cells = [];
      field = '';
      line += 1;
      recordLine = line;
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || cells.length > 0) {
    cells.push(field);
    records.push({ line: recordLine, cells });
  }
  return records.filter((record) => record.cells.some((cell) => cell.trim() !== ''));
}

function validateRow(
  row: Omit<PreviewRow, 'errors'>,
  categories: string[] | null,
  t: ImportCsvT,
): string[] {
  const errors: string[] = [];
  if (!row.title) errors.push(t('errors.titleRequired'));
  else if (row.title.length > 200) errors.push(t('errors.titleTooLong', { max: 200 }));
  if (!row.content) errors.push(t('errors.contentRequired'));
  else if (row.content.length > 5000) errors.push(t('errors.contentTooLong', { max: 5000 }));
  if (!row.category) errors.push(t('errors.categoryRequired'));
  else if (categories && !categories.includes(row.category)) {
    errors.push(t('errors.categoryInvalid', { value: row.category }));
  }
  if (row.priority && !(PRIORITIES as readonly string[]).includes(row.priority)) {
    errors.push(t('errors.priorityInvalid', { value: row.priority }));
  }
  if (row.contact.length > 200) errors.push(t('errors.contactTooLong', { max: 200 }));
  if (row.appVersion.length > 50) errors.push(t('errors.versionTooLong', { max: 50 }));
  return errors;
}

function parseCsvText(
  text: string,
  categories: string[] | null,
  t: ImportCsvT,
  listSeparator: string,
): ParsedCsv {
  if (!text.trim()) return EMPTY_PARSED;

  const records = parseCsv(text);
  if (records.length === 0) return EMPTY_PARSED;

  const [headerRecord, ...dataRecords] = records;
  const header = headerRecord?.cells.map((cell) => cell.trim().toLowerCase()) ?? [];
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      ...EMPTY_PARSED,
      headerError: t('errors.missingHeader', { columns: missing.join(listSeparator) }),
    };
  }
  if (dataRecords.length > MAX_ROWS) {
    return {
      ...EMPTY_PARSED,
      headerError: t('errors.tooManyRows', { max: MAX_ROWS, count: dataRecords.length }),
    };
  }

  const columnIndex = (column: string) => header.indexOf(column);
  const titleIndex = columnIndex('title');
  const contentIndex = columnIndex('content');
  const categoryIndex = columnIndex('category');
  const priorityIndex = columnIndex('priority');
  const contactIndex = columnIndex('contact');
  const appVersionIndex = columnIndex('app_version');

  const rows: PreviewRow[] = dataRecords.map((record, index) => {
    const cell = (columnIndexValue: number) =>
      columnIndexValue >= 0 ? (record.cells[columnIndexValue] ?? '').trim() : '';
    const base = {
      index,
      line: record.line,
      title: cell(titleIndex),
      content: cell(contentIndex),
      category: cell(categoryIndex),
      priority: cell(priorityIndex) || 'medium',
      contact: cell(contactIndex),
      appVersion: cell(appVersionIndex),
    };
    return {
      ...base,
      errors: validateRow(base, categories, t),
    };
  });

  const invalid = rows.filter((row) => row.errors.length > 0).length;
  return {
    headerError: null,
    rows,
    total: rows.length,
    valid: rows.length - invalid,
    invalid,
  };
}

function buildTemplateCsv(t: ImportCsvT): string {
  const header = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(',');
  const sample = [
    t('file.templateTitle'),
    t('file.templateContent'),
    'bug',
    'high',
    'user@example.com',
  ].map(csvEscape);
  return `\uFEFF${header}\n${sample.join(',')}\n`;
}

function downloadTemplate(t: ImportCsvT): void {
  const blob = new Blob([buildTemplateCsv(t)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'feedback-import-template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const priorityBadgeTone = (priority: string): 'gray' | 'amber' | 'red' | 'blue' => {
  if (priority === 'critical') return 'red';
  if (priority === 'high') return 'amber';
  if (priority === 'low') return 'blue';
  return 'gray';
};

export function ImportFeedbackModal({
  projects,
  defaultProjectId,
  onClose,
}: {
  projects: ProjectAccessInfo[];
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('importCsv');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState(() => defaultProjectId || projects[0]?.id || '');
  const [text, setText] = useState('');
  const [serverErrors, setServerErrors] = useState<Record<number, string[]>>({});
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const { data: categoryConfigs, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', projectId],
    queryFn: () => apiRequest<CategoryConfig[]>(`/org/projects/${projectId}/categories`),
    enabled: !!projectId,
  });

  const hasCustomCategories = (categoryConfigs?.length ?? 0) > 0;
  const categories = useMemo<string[] | null>(() => {
    if (!projectId) return null;
    if (hasCustomCategories) return (categoryConfigs ?? []).map((item) => item.name);
    if (categoriesLoading) return null;
    return [...CATEGORY_OPTIONS];
  }, [projectId, hasCustomCategories, categoryConfigs, categoriesLoading]);

  const listSeparator = i18n.language === 'zh' ? '、' : ', ';
  const parsed = useMemo(
    () => parseCsvText(text, categories, t, listSeparator),
    [text, categories, t, listSeparator],
  );

  const rowsForServer = useMemo(
    () =>
      parsed.rows.map((row) => ({
        title: row.title,
        content: row.content,
        category: row.category,
        priority: row.priority,
        contact: row.contact || undefined,
        app_version: row.appVersion || undefined,
      })),
    [parsed.rows],
  );

  const importMutation = useMutation({
    mutationFn: async (): Promise<ImportResponse> => {
      const body = { project_id: projectId, rows: rowsForServer };
      const dryRun = await apiRequest<ImportResponse>('/admin/feedback/import', {
        method: 'POST',
        body: JSON.stringify({ ...body, dry_run: true }),
      });
      if (dryRun.invalid_rows.length > 0) return { ...dryRun, imported: 0 };
      return apiRequest<ImportResponse>('/admin/feedback/import', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (result) => {
      if (result.invalid_rows.length > 0) {
        const errors: Record<number, string[]> = {};
        result.invalid_rows.forEach((row) => {
          errors[row.index] = row.errors;
        });
        setServerErrors(errors);
        toast.show(t('toast.serverInvalid'), 'error');
        return;
      }
      toast.show(t('toast.imported', { count: result.imported ?? 0 }));
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      onClose();
    },
    onError: (err) => {
      toast.show(
        err instanceof Error ? translateServerMessage(err.message, t) : t('toast.importFailed'),
        'error',
      );
    },
  });

  const updateText = (value: string) => {
    setText(value);
    setServerErrors({});
  };

  const loadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.show(t('toast.chooseCsvFile'), 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.show(t('toast.fileTooLarge'), 'error');
      return;
    }
    try {
      const content = await file.text();
      setFileName(file.name);
      updateText(content);
    } catch {
      toast.show(t('toast.readFileFailed'), 'error');
    }
  };

  const rowsWithErrors = parsed.rows.map((row) => ({
    ...row,
    errors:
      row.errors.length > 0
        ? row.errors
        : (serverErrors[row.index] ?? []).map((error) => translateServerMessage(error, t)),
  }));
  const totalInvalid = rowsWithErrors.filter((row) => row.errors.length > 0).length;
  const previewRows = rowsWithErrors.slice(0, PREVIEW_LIMIT);
  const hasAnyError = totalInvalid > 0 || Boolean(parsed.headerError);
  const serverInvalidRowCount = Object.keys(serverErrors).length;
  const canImport =
    !!projectId &&
    !categoriesLoading &&
    parsed.headerError === null &&
    rowsForServer.length > 0 &&
    !hasAnyError &&
    !importMutation.isPending;

  const submit = () => {
    if (!canImport) return;
    importMutation.mutate();
  };

  return (
    <Modal
      title={t('modal.title')}
      description={t('modal.description')}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[11px] text-gray-400 dark:text-gray-500">
            {parsed.rows.length > 0 && !parsed.headerError
              ? t('footer.summary', {
                  total: parsed.total,
                  valid: parsed.total - totalInvalid,
                  invalid: totalInvalid,
                })
              : t('footer.headerHint')}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={importMutation.isPending}>
            {t('buttons.cancel')}
          </Button>
          <Button size="sm" onClick={submit} disabled={!canImport}>
            {importMutation.isPending
              ? t('buttons.importing')
              : rowsForServer.length > 0
                ? t('buttons.startImportCount', { count: rowsForServer.length })
                : t('buttons.startImport')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {projects.length > 1 && (
          <Field label={t('form.projectLabel')} htmlFor="import-project">
            <select
              id="import-project"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setServerErrors({});
              }}
              className={clsx(inputClass, 'appearance-none pr-9')}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="import-csv-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void loadFile(file);
            }}
            className={clsx(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
              dragging
                ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-600/15 dark:text-brand-300'
                : 'border-surface-3 bg-surface-0 text-gray-600 hover:border-gray-300 hover:bg-surface-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600',
            )}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4 13.5v1.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t('file.choose')}
          </label>
          <input
            id="import-csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
              event.target.value = '';
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => downloadTemplate(t)}>
            {t('file.downloadTemplate')}
          </Button>
          {fileName && (
            <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">{fileName}</span>
          )}
        </div>

        <Field
          label={t('form.contentLabel')}
          htmlFor="import-csv-text"
          hint={t('form.contentHint')}
        >
          <textarea
            id="import-csv-text"
            value={text}
            onChange={(event) => updateText(event.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={t('form.placeholder')}
            className={clsx(inputClass, 'h-auto min-h-[128px] resize-y py-2 font-mono text-[12px] leading-relaxed')}
          />
        </Field>

        {parsed.headerError && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11px] leading-relaxed text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {parsed.headerError}
          </p>
        )}

        {!parsed.headerError && parsed.rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <Badge tone={totalInvalid > 0 ? 'gray' : 'green'}>
                {t('stats.valid', { count: parsed.total - totalInvalid })}
              </Badge>
              <Badge tone={totalInvalid > 0 ? 'red' : 'gray'}>
                {t('stats.error', { count: totalInvalid })}
              </Badge>
              <span>{t('stats.totalRows', { count: parsed.total })}</span>
              {parsed.rows.length > PREVIEW_LIMIT && (
                <span>{t('stats.previewLimit', { count: PREVIEW_LIMIT })}</span>
              )}
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-surface-3 dark:border-gray-700">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-surface-1/95 dark:bg-gray-800">
                  <tr className="border-b border-surface-2 dark:border-gray-700/60">
                    {[
                      t('table.line'),
                      t('table.titleContent'),
                      t('table.categoryPriority'),
                      t('table.status'),
                    ].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2 dark:divide-gray-700/50">
                  {previewRows.map((row) => {
                    const invalid = row.errors.length > 0;
                    return (
                      <tr
                        key={row.index}
                        className={clsx(
                          invalid
                            ? 'bg-rose-50/60 dark:bg-rose-500/10'
                            : 'hover:bg-surface-1/60 dark:hover:bg-gray-700/20',
                        )}
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-gray-400 dark:text-gray-500">
                          {row.line}
                        </td>
                        <td className="max-w-[220px] px-3 py-2">
                          <p className="truncate font-medium text-gray-800 dark:text-gray-200">
                            {row.title || t('table.emptyTitle')}
                          </p>
                          <p className="mt-0.5 truncate text-gray-400 dark:text-gray-500">
                            {row.content || t('table.emptyContent')}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: categoryColor(row.category) }}
                              aria-hidden="true"
                            />
                            <span className="font-mono">{row.category || '—'}</span>
                          </span>
                          <span className="mt-1 block">
                            <Badge tone={priorityBadgeTone(row.priority)}>
                              {priorityLabel(row.priority as FeedbackPriority, i18n.language)}
                            </Badge>
                          </span>
                        </td>
                        <td className="max-w-[200px] px-3 py-2">
                          {invalid ? (
                            <ul className="space-y-0.5 text-rose-600 dark:text-rose-400">
                              {row.errors.map((error) => (
                                <li key={error}>{error}</li>
                              ))}
                            </ul>
                          ) : (
                            <Badge tone="green">{t('badge.valid')}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {serverInvalidRowCount > 0 && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11px] leading-relaxed text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {t('server.banner', { count: serverInvalidRowCount })}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
