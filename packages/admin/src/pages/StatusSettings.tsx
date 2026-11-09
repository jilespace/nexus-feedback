import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Skeleton,
  settingsInputClass,
} from '@/components/ui';
import { statusLabel } from '@/utils/labels';
import type { FeedbackStatus, StatusConfig } from '@/types';

const rowActionClass =
  'inline-flex h-8 items-center rounded-md px-2 text-[11px] font-medium text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400';

const PRESET_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#6B7280'];

const KNOWN_STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

function isKnownStatus(name: string): name is FeedbackStatus {
  return (KNOWN_STATUSES as string[]).includes(name);
}

export function StatusSettings() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StatusConfig | null>(null);

  const {
    data: statuses,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['statuses', projectId],
    queryFn: () => apiRequest<StatusConfig[]>(`/org/projects/${projectId}/statuses`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color: string; position: number; is_closed: boolean }) =>
      apiRequest(`/org/projects/${projectId}/statuses`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses', projectId] });
      setFormOpen(false);
      toast('状态已创建');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '创建失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/org/projects/${projectId}/statuses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses', projectId] });
      setConfirmDelete(null);
      toast('状态已删除');
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    },
  });

  const list = statuses ?? [];
  const usingDefaults = list.length > 0 && list.every((status) => status.id.startsWith('default_'));
  const nextPosition = list.length > 0 ? Math.max(...list.map((status) => status.position)) + 1 : 0;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="状态配置"
        description="自定义此项目的反馈状态流转；未配置时使用默认状态（待处理、处理中、已解决、已关闭）。"
        actions={
          projectId ? (
            <Button onClick={() => setFormOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              添加状态
            </Button>
          ) : undefined
        }
      />

      {!projectId ? (
        <Card>
          <EmptyState
            title="请先选择一个项目"
            description="从项目列表进入项目后，即可在这里配置状态流转。"
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-2 px-4 py-3.5 dark:border-gray-700/60 sm:px-5">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                工作流状态
                <span className="font-normal tabular-nums text-gray-400">({list.length})</span>
                {usingDefaults && <Badge tone="gray">系统默认</Badge>}
              </h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                按位置升序展示在公开看板与列表筛选中；关闭态表示流程终点。
              </p>
            </div>
          </div>

          {isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">状态加载失败</p>
              <p className="max-w-sm text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                {error instanceof Error ? error.message : '请检查网络后重试'}
              </p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                重试
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              title="暂无状态配置"
              description="添加自定义状态以替换系统默认状态。"
              action={{ label: '添加状态', onClick: () => setFormOpen(true) }}
            />
          ) : (
            <>
              {usingDefaults && (
                <div className="flex items-start gap-2.5 border-b border-surface-2 bg-accent-50/70 px-4 py-3 dark:border-gray-700/60 dark:bg-accent-500/10 sm:px-5">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-300"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="8" cy="5" r="0.85" fill="currentColor" />
                  </svg>
                  <p className="text-xs leading-relaxed text-accent-600 dark:text-accent-300">
                    当前使用系统默认状态。添加任意自定义状态后，此列表将替换为自定义配置，默认状态不再生效。
                  </p>
                </div>
              )}
              <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
                {list.map((status) => {
                  const localName = isKnownStatus(status.name) ? statusLabel(status.name) : null;
                  const isDefault = status.id.startsWith('default_');
                  return (
                    <li
                      key={status.id}
                      className="group flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors hover:bg-surface-1/60 dark:hover:bg-gray-700/20 sm:px-5"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-2 ring-black/5 dark:ring-white/10"
                        style={{ backgroundColor: status.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                            {localName ?? status.name}
                          </span>
                          {localName && (
                            <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
                              {status.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
                          位置 {status.position}
                        </span>
                        {status.is_closed && <Badge tone="gray">关闭态</Badge>}
                        {isDefault ? (
                          <span className="inline-flex h-8 items-center px-2 text-[11px] text-gray-300 dark:text-gray-600">
                            系统内置
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(status)}
                            className={rowActionClass}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      )}

      {formOpen && (
        <StatusFormModal
          existing={list}
          defaultPosition={nextPosition}
          isPending={createMutation.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      {confirmDelete && (
        <Modal
          title="删除状态"
          description={`确定要删除状态「${confirmDelete.name}」吗？`}
          onClose={() => setConfirmDelete(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
              >
                {deleteMutation.isPending ? '删除中…' : '确认删除'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            删除后不可恢复。若已有反馈正在使用该状态，系统会阻止删除，请先为这些反馈切换状态。
          </p>
        </Modal>
      )}
    </div>
  );
}

function StatusFormModal({
  existing,
  defaultPosition,
  isPending,
  onClose,
  onSubmit,
}: {
  existing: StatusConfig[];
  defaultPosition: number;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; color: string; position: number; is_closed: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0] ?? '#3B82F6');
  const [position, setPosition] = useState(defaultPosition);
  const [isClosed, setIsClosed] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('请输入状态名称');
      return;
    }
    if (existing.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('已存在同名状态');
      return;
    }
    setNameError(null);
    onSubmit({
      name: trimmed,
      color,
      position: Number.isFinite(position) && position >= 0 ? Math.floor(position) : 0,
      is_closed: isClosed,
    });
  }

  return (
    <Modal
      title="添加状态"
      description="自定义状态将替换系统默认状态，并用于反馈列表筛选与公开看板。"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="status-form" size="sm" disabled={isPending}>
            {isPending ? '创建中…' : '创建状态'}
          </Button>
        </>
      }
    >
      <form
        id="status-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Field
          label="状态名称"
          htmlFor="status-name"
          error={nameError ?? undefined}
          hint="建议使用英文标识（如 reviewing、waiting），会作为 API 中的状态值。"
        >
          <input
            id="status-name"
            type="text"
            value={name}
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="例如：reviewing"
            required
            className={settingsInputClass(!!nameError)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="颜色">
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`选择颜色 ${preset}`}
                  aria-pressed={color.toLowerCase() === preset.toLowerCase()}
                  onClick={() => setColor(preset)}
                  className={clsx(
                    'h-7 w-7 rounded-full ring-offset-2 transition-all dark:ring-offset-gray-800',
                    color.toLowerCase() === preset.toLowerCase()
                      ? 'scale-110 ring-2 ring-gray-900 dark:ring-white'
                      : 'ring-1 ring-black/10 hover:scale-105 dark:ring-white/15',
                  )}
                  style={{ backgroundColor: preset }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="自定义颜色"
                className="ml-1 h-8 w-10 cursor-pointer rounded-md border border-surface-3 bg-surface-0 p-1 dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </Field>
          <Field label="位置" htmlFor="status-position" hint="数字越小越靠前">
            <input
              id="status-position"
              type="number"
              min={0}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              className={settingsInputClass()}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-surface-3 bg-surface-1/60 px-3 py-2.5 transition-colors hover:bg-surface-1 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:bg-gray-800">
          <input
            type="checkbox"
            checked={isClosed}
            onChange={(event) => setIsClosed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600"
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-gray-700 dark:text-gray-200">关闭态</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              标记为流程终点，反馈进入此状态后视为已关闭。
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
