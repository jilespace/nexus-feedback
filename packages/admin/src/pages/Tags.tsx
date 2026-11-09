import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest, fetchOrgTags, type OrgTagItem } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Button, Card, CardHeader, EmptyState, Field, Skeleton, settingsInputClass } from '@/components/ui';
import { useToast } from '@/components/Toast';

const DEFAULT_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
];

export function Tags() {
  const { member } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('team');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ef4444');
  const [confirmDelete, setConfirmDelete] = useState<OrgTagItem | null>(null);

  const presets = [
    { name: t('tags.presets.bug'), color: '#ef4444' },
    { name: t('tags.presets.urgent'), color: '#f97316' },
    { name: t('tags.presets.discussion'), color: '#eab308' },
    { name: t('tags.presets.customer'), color: '#8b5cf6' },
  ];

  const { data: tags, isLoading } = useQuery({
    queryKey: ['org-tags'],
    queryFn: fetchOrgTags,
  });

  const createMutation = useMutation({
    mutationFn: (params: { name: string; color: string }) =>
      apiRequest('/org/tags', { method: 'POST', body: JSON.stringify(params) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-tags'] });
      toast.show(t('tags.toast.created'));
      setName('');
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('tags.toast.createFailed'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/org/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-tags'] });
      setConfirmDelete(null);
      toast.show(t('tags.toast.deleted'));
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast.show(err instanceof Error ? err.message : t('tags.toast.deleteFailed'), 'error');
    },
  });

  const canManage = member?.role === 'owner' || member?.role === 'admin';
  const list = tags ?? [];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t('tags.title')} description={t('tags.description')} />

      {canManage && (
        <Card className="p-5">
          <CardHeader
            title={t('tags.newCard.title')}
            description={t('tags.newCard.description')}
            className="mb-4"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              {t('tags.newCard.presets')}
            </span>
            {presets.map((preset) => (
              <button
                key={preset.color}
                type="button"
                onClick={() => {
                  setName(preset.name);
                  setColor(preset.color);
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-surface-3 bg-surface-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: preset.color }} />
                {preset.name}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate({ name: name.trim(), color });
            }}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Field label={t('tags.newCard.nameLabel')} htmlFor="tag-name" className="min-w-0 flex-1">
              <input
                id="tag-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('tags.newCard.namePlaceholder')}
                required
                className={settingsInputClass()}
              />
            </Field>
            <Field label={t('tags.newCard.colorLabel')}>
              <div className="flex h-9 items-center gap-1.5">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={t('tags.newCard.colorAria', { color: c })}
                    aria-pressed={color === c}
                    className={`h-6 w-6 rounded-full ring-offset-2 transition-all dark:ring-offset-gray-800 ${
                      color === c
                        ? 'scale-110 ring-2 ring-gray-900 dark:ring-white'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </Field>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? t('tags.newCard.creating') : t('tags.newCard.create')}
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-2 px-5 py-3.5 dark:border-gray-700/60">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('tags.allTitle')}
            <span className="ml-1.5 font-normal text-gray-400">({list.length})</span>
          </h2>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title={t('tags.emptyTitle')}
            description={t('tags.emptyDescription')}
          />
        ) : (
          <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
            {list.map((tag) => {
              const usage = tag.usage_count ?? 0;
              return (
                <li
                  key={tag.id}
                  className="group flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-surface-1/60 dark:hover:bg-gray-700/20"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color ?? '#6b7280' }}
                    />
                    <span className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                      {tag.name}
                    </span>
                    <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] tabular-nums text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
                      {t('tags.usage', { count: usage })}
                    </span>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(tag)}
                      aria-label={t('tags.deleteAria', { name: tag.name })}
                      className="rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-500 opacity-0 transition-all hover:text-rose-500 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group-hover:opacity-100 dark:text-gray-400 dark:hover:text-rose-400"
                    >
                      {t('tags.delete')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {confirmDelete && (
        <Modal
          title={t('tags.deleteModal.title')}
          description={t('tags.deleteModal.description', { name: confirmDelete.name })}
          onClose={() => setConfirmDelete(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
                {t('tags.deleteModal.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
              >
                {deleteMutation.isPending
                  ? t('tags.deleteModal.deleting')
                  : t('tags.deleteModal.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {(confirmDelete.usage_count ?? 0) > 0
              ? t('tags.deleteModal.bodyInUse', { count: confirmDelete.usage_count })
              : t('tags.deleteModal.bodyUnused')}
          </p>
        </Modal>
      )}
    </div>
  );
}
