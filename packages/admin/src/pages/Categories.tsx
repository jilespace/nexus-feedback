import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { CATEGORY_PALETTE } from '@/utils/labels';
import type { CategoryConfig } from '@/types';

const LABEL_CLASS =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500';

const inputClass =
  'h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-3 text-[13px] text-gray-900 placeholder:text-gray-400 transition-colors focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100';

const rowActionClass =
  'inline-flex h-8 items-center rounded-md px-2 text-[11px] font-medium text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400';

export function Categories() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CategoryConfig | null>(null);

  const {
    data: categories,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['categories', projectId],
    queryFn: () => apiRequest<CategoryConfig[]>(`/org/projects/${projectId}/categories`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      apiRequest(`/org/projects/${projectId}/categories`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', projectId] });
      setFormOpen(false);
      toast('分类已添加');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '添加失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/org/projects/${projectId}/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', projectId] });
      setConfirmDelete(null);
      toast('分类已删除');
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    },
  });

  const list = categories ?? [];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="自定义分类"
        description="定义此项目的反馈分类；未配置时使用默认分类（Bug 修复、功能建议、性能优化、界面体验、其他）。"
        actions={
          projectId ? (
            <Button onClick={() => setFormOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              新建分类
            </Button>
          ) : undefined
        }
      />

      {!projectId ? (
        <Card>
          <EmptyState
            title="请先选择一个项目"
            description="从项目列表进入项目后，即可在这里配置反馈分类。"
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-2 px-4 py-3.5 dark:border-gray-700/60 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                分类列表
                <span className="ml-1.5 font-normal tabular-nums text-gray-400">({list.length})</span>
              </h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                按创建顺序显示，用于反馈提交页、公开看板与列表筛选。
              </p>
            </div>
          </div>

          {isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">分类加载失败</p>
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
              title="暂无自定义分类"
              description="当前使用默认分类。添加自定义分类后，默认分类将被替换。"
              action={{ label: '新建分类', onClick: () => setFormOpen(true) }}
            />
          ) : (
            <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
              {list.map((category) => (
                <li
                  key={category.id}
                  className="group flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-1/60 dark:hover:bg-gray-700/20 sm:px-5"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 dark:ring-white/10"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                      {category.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tabular-nums text-gray-400 dark:text-gray-500">
                      {category.color}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(category)}
                    className={rowActionClass}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {formOpen && (
        <CategoryFormModal
          existing={list}
          isPending={createMutation.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      {confirmDelete && (
        <Modal
          title="删除分类"
          description={`确定要删除分类「${confirmDelete.name}」吗？`}
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
            删除后不可恢复，该分类将不再出现在提交页、看板与筛选选项中；已有反馈会保留其分类字段。
          </p>
        </Modal>
      )}
    </div>
  );
}

function CategoryFormModal({
  existing,
  isPending,
  onClose,
  onSubmit,
}: {
  existing: CategoryConfig[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; color: string }) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_PALETTE[0] ?? '#6366f1');
  const [nameError, setNameError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('请输入分类名称');
      return;
    }
    if (existing.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('已存在同名分类');
      return;
    }
    setNameError(null);
    onSubmit({ name: trimmed, color });
  }

  return (
    <Modal
      title="新建分类"
      description="分类会同步出现在反馈提交页、公开看板与后台筛选中。"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="category-form" size="sm" disabled={isPending}>
            {isPending ? '创建中…' : '创建分类'}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="category-name" className={LABEL_CLASS}>
            分类名称
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="例如：客户端问题"
            required
            className={clsx(
              inputClass,
              nameError &&
                'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15 dark:border-rose-500/70',
            )}
          />
          {nameError ? (
            <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">{nameError}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              也可使用英文标识，如 billing、mobile，便于 API 提交时复用。
            </p>
          )}
        </div>

        <div>
          <span className={LABEL_CLASS}>颜色</span>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_PALETTE.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`选择颜色 ${preset}`}
                aria-pressed={color.toLowerCase() === preset}
                onClick={() => setColor(preset)}
                className={clsx(
                  'h-7 w-7 rounded-full ring-offset-2 transition-all dark:ring-offset-gray-800',
                  color.toLowerCase() === preset
                    ? 'scale-110 ring-2 ring-gray-900 dark:ring-white'
                    : 'ring-1 ring-black/10 hover:scale-105 dark:ring-white/15',
                )}
                style={{ backgroundColor: preset }}
              />
            ))}
            <span className="ml-1 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="自定义颜色"
                className="h-8 w-10 cursor-pointer rounded-md border border-surface-3 bg-surface-0 p-1 dark:border-gray-700 dark:bg-gray-900"
              />
              <span className="font-mono text-[11px] uppercase tabular-nums text-gray-400 dark:text-gray-500">
                {color}
              </span>
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-surface-3 bg-surface-1/60 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">预览</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
              {name.trim() || '分类名称'}
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
