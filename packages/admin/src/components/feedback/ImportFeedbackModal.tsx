import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { Modal } from '@/components/Modal';
import { Badge, Button, Field, settingsInputClass } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { CATEGORY_OPTIONS, categoryColor, priorityLabel } from '@/utils/labels';
import type { CategoryConfig, ProjectAccessInfo } from '@/types';

const MAX_ROWS = 500;
const PREVIEW_LIMIT = 20;
const REQUIRED_COLUMNS = ['title', 'content', 'category'] as const;
const OPTIONAL_COLUMNS = ['priority', 'contact', 'app_version'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const PRIORITY_LABELS: Record<string, string> = {
  low: priorityLabel('low'),
  medium: priorityLabel('medium'),
  high: priorityLabel('high'),
  critical: priorityLabel('critical'),
};

const inputClass = settingsInputClass();

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
): string[] {
  const errors: string[] = [];
  if (!row.title) errors.push('标题不能为空');
  else if (row.title.length > 200) errors.push('标题不能超过 200 个字符');
  if (!row.content) errors.push('内容不能为空');
  else if (row.content.length > 5000) errors.push('内容不能超过 5000 个字符');
  if (!row.category) errors.push('分类不能为空');
  else if (categories && !categories.includes(row.category)) {
    errors.push(`无效的分类: ${row.category}`);
  }
  if (row.priority && !(PRIORITIES as readonly string[]).includes(row.priority)) {
    errors.push(`无效的优先级: ${row.priority}`);
  }
  if (row.contact.length > 200) errors.push('联系方式不能超过 200 个字符');
  if (row.appVersion.length > 50) errors.push('版本号不能超过 50 个字符');
  return errors;
}

function parseCsvText(text: string, categories: string[] | null): ParsedCsv {
  if (!text.trim()) return EMPTY_PARSED;

  const records = parseCsv(text);
  if (records.length === 0) return EMPTY_PARSED;

  const [headerRecord, ...dataRecords] = records;
  const header = headerRecord?.cells.map((cell) => cell.trim().toLowerCase()) ?? [];
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      ...EMPTY_PARSED,
      headerError: `表头缺少必需列：${missing.join('、')}。请使用模板或确保首行包含 title,content,category。`,
    };
  }
  if (dataRecords.length > MAX_ROWS) {
    return {
      ...EMPTY_PARSED,
      headerError: `单次最多导入 ${MAX_ROWS} 条反馈，当前共 ${dataRecords.length} 行。`,
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
      errors: validateRow(base, categories),
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

function buildTemplateCsv(): string {
  const header = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(',');
  const sample = [
    '登录后页面白屏',
    '点击登录按钮后页面空白，控制台报 500 错误',
    'bug',
    'high',
    'user@example.com',
  ].map(csvEscape);
  return `\uFEFF${header}\n${sample.join(',')}\n`;
}

function downloadTemplate(): void {
  const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' });
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

  const parsed = useMemo(() => parseCsvText(text, categories), [text, categories]);

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
        toast.show('服务端校验未通过，请修正标记的行', 'error');
        return;
      }
      toast.show(`已导入 ${result.imported ?? 0} 条反馈`);
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      onClose();
    },
    onError: (err) => {
      toast.show(err instanceof Error ? err.message : '导入失败', 'error');
    },
  });

  const updateText = (value: string) => {
    setText(value);
    setServerErrors({});
  };

  const loadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.show('请选择 .csv 文件', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.show('CSV 文件不能超过 2MB', 'error');
      return;
    }
    try {
      const content = await file.text();
      setFileName(file.name);
      updateText(content);
    } catch {
      toast.show('读取文件失败', 'error');
    }
  };

  const rowsWithErrors = parsed.rows.map((row) => ({
    ...row,
    errors: row.errors.length > 0 ? row.errors : serverErrors[row.index] ?? [],
  }));
  const totalInvalid =
    rowsWithErrors.filter((row) => row.errors.length > 0).length;
  const previewRows = rowsWithErrors.slice(0, PREVIEW_LIMIT);
  const hasAnyError = totalInvalid > 0 || Boolean(parsed.headerError);
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
      title="导入反馈 CSV"
      description="上传或粘贴 CSV 数据，先校验再写入；单次最多 500 条，分类需与项目配置一致。"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[11px] text-gray-400 dark:text-gray-500">
            {parsed.rows.length > 0 && !parsed.headerError
              ? `共 ${parsed.total} 行 · 有效 ${parsed.total - totalInvalid} · 错误 ${totalInvalid}`
              : '首行为表头，支持 BOM / CRLF / 引号转义'}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={importMutation.isPending}>
            取消
          </Button>
          <Button size="sm" onClick={submit} disabled={!canImport}>
            {importMutation.isPending
              ? '导入中...'
              : `开始导入${rowsForServer.length > 0 ? `（${rowsForServer.length} 条）` : ''}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {projects.length > 1 && (
          <Field label="项目" htmlFor="import-project">
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
            选择 CSV 文件 / 拖拽到此处
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
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            下载模板
          </Button>
          {fileName && (
            <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">{fileName}</span>
          )}
        </div>

        <Field
          label="CSV 内容"
          htmlFor="import-csv-text"
          hint="列顺序不限，必需列：title, content, category；可选列：priority, contact, app_version。priority 留空按 medium 导入。"
        >
          <textarea
            id="import-csv-text"
            value={text}
            onChange={(event) => updateText(event.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'title,content,category,priority,contact\n登录后页面白屏,点击登录按钮后页面空白,bug,high,user@example.com'}
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
              <Badge tone={totalInvalid > 0 ? 'gray' : 'green'}>有效 {parsed.total - totalInvalid}</Badge>
              <Badge tone={totalInvalid > 0 ? 'red' : 'gray'}>错误 {totalInvalid}</Badge>
              <span>共 {parsed.total} 行</span>
              {parsed.rows.length > PREVIEW_LIMIT && (
                <span>仅预览前 {PREVIEW_LIMIT} 行</span>
              )}
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-surface-3 dark:border-gray-700">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-surface-1/95 dark:bg-gray-800">
                  <tr className="border-b border-surface-2 dark:border-gray-700/60">
                    {['行', '标题 / 内容', '分类 · 优先级', '状态'].map((label) => (
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
                            {row.title || '（空标题）'}
                          </p>
                          <p className="mt-0.5 truncate text-gray-400 dark:text-gray-500">
                            {row.content || '（空内容）'}
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
                              {PRIORITY_LABELS[row.priority] ?? row.priority}
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
                            <Badge tone="green">有效</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {Object.keys(serverErrors).length > 0 && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11px] leading-relaxed text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                服务端校验发现 {Object.keys(serverErrors).length} 行问题，请按表格中的错误提示修改后重新导入。
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
