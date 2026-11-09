import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiRequest } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { ProjectAccessInfo } from '@/types';

type RegeneratedKey = {
  id: string;
  api_key: string;
  api_key_prefix: string;
};

type NewProject = {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  api_key_prefix: string;
  allowed_origins: string[];
  created_at: string;
};

function getBoardUrl(slug: string, boardUrl?: string | null): string {
  if (boardUrl) return `${boardUrl.replace(/\/$/, '')}/${slug}`;
  const devBoard = import.meta.env.DEV ? 'http://localhost:8082' : window.location.origin;
  return `${devBoard}/${slug}`;
}

function CopyButton({
  value,
  onCopied,
  label,
}: {
  value: string;
  onCopied: (v: string, label: string) => void;
  label?: string;
}) {
  const { t } = useTranslation('content');
  const resolvedLabel = label ?? t('applications.copy');
  return (
    <button
      type="button"
      onClick={() => onCopied(value, resolvedLabel)}
      className="inline-flex h-6 items-center gap-1 rounded-md border border-surface-3 bg-surface-0 px-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
        <path
          d="M6 9.5a2.5 2.5 0 0 1 3.5-.3l1.8 1.8a2.5 2.5 0 0 1-3.5 3.5l-.9-.9M10 8.5a2.5 2.5 0 0 0-3.5.3L4.7 10.6a2.5 2.5 0 0 0 3.5 3.5l.9-.9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      {resolvedLabel}
    </button>
  );
}

export function Applications() {
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const { t } = useTranslation('content');
  const [regeneratedKey, setRegeneratedKey] = useState<RegeneratedKey | null>(null);
  const [confirmProject, setConfirmProject] = useState<ProjectAccessInfo | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState<NewProject | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<ProjectAccessInfo[]>('/org/projects'),
  });

  const { data: orgBoardUrl } = useQuery({
    queryKey: ['org-board-url'],
    queryFn: () => apiRequest<{ board_url: string | null }>('/org/settings'),
    select: (data) => data.board_url,
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<RegeneratedKey>(`/org/projects/${id}/regenerate-key`, { method: 'POST' }),
    onSuccess: (data) => {
      setRegeneratedKey(data);
      setConfirmProject(null);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast(t('applications.toast.keyRegenerated'), 'success');
    },
    onError: (err: Error) => {
      setConfirmProject(null);
      toast(err.message || t('applications.toast.regenerateFailed'), 'error');
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; slug?: string }) =>
      apiRequest<NewProject>('/org/projects', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (data) => {
      setNewProjectKey(data);
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast(t('applications.toast.projectCreated'), 'success');
    },
    onError: (err: Error) => toast(err.message || t('applications.toast.createFailed'), 'error'),
  });

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('applications.toast.copied', { label }), 'success');
    } catch {
      toast(t('applications.toast.copyFailed'), 'error');
    }
  };

  const list = projects ?? [];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('applications.pageTitle')}
        description={t('applications.pageDescription')}
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            {t('applications.create')}
          </Button>
        }
      />

      {newProjectKey && (
        <ApiKeyBanner
          tone="success"
          title={t('applications.newKeyBannerTitle')}
          description={t('applications.newKeyBannerDescription')}
          apiKey={newProjectKey.api_key}
          onCopy={() => handleCopy(newProjectKey.api_key, 'API Key')}
          onDismiss={() => setNewProjectKey(null)}
        />
      )}

      {regeneratedKey && (
        <ApiKeyBanner
          tone="warning"
          title={t('applications.regeneratedKeyBannerTitle')}
          description={t('applications.regeneratedKeyBannerDescription')}
          apiKey={regeneratedKey.api_key}
          onCopy={() => handleCopy(regeneratedKey.api_key, 'API Key')}
          onDismiss={() => setRegeneratedKey(null)}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            title={t('applications.emptyTitle')}
            description={t('applications.emptyDescription')}
            action={{
              label: t('applications.create'),
              onClick: () => setShowCreateModal(true),
            }}
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((project) => {
            const boardUrl = getBoardUrl(project.slug, orgBoardUrl);
            return (
              <Card key={project.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-50">
                          {project.name}
                        </h2>
                        <Badge tone="brand">/{project.slug}</Badge>
                        <Badge tone="gray">
                          {t('applications.feedbackCount', {
                            count: project.feedback_count ?? 0,
                          })}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-400 dark:text-gray-500">
                          {t('applications.publicBoard')}
                        </span>
                        <a
                          href={boardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-full truncate font-mono text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          {boardUrl}
                        </a>
                        <CopyButton value={boardUrl} onCopied={handleCopy} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/projects/${project.id}/widget`}
                      className="inline-flex h-8 items-center rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
                    >
                      {t('applications.widgetConfig')}
                    </Link>
                    <Link
                      to={`/projects/${project.id}/settings`}
                      className="inline-flex h-8 items-center rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
                    >
                      {t('applications.projectSettings')}
                    </Link>
                    <Link
                      to={`/projects/${project.id}/webhooks`}
                      className="inline-flex h-8 items-center rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
                    >
                      {t('applications.webhooks')}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500"
                      onClick={() => setConfirmProject(project)}
                    >
                      {t('applications.resetKey')}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-surface-2 pt-4 dark:border-gray-700/60 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
                      Project API Key
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
                        {project.api_key_prefix
                          ? `${project.api_key_prefix}…`
                          : t('applications.apiKeyNotGenerated')}
                      </code>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {t('applications.apiKeyHint')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
                      Allowed origins
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {project.allowed_origins.length > 0 ? (
                        project.allowed_origins.map((origin) => (
                          <span
                            key={origin}
                            className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-gray-500 dark:bg-gray-700/60 dark:text-gray-400"
                          >
                            {origin}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {t('applications.originsUnrestricted')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(input) => createMutation.mutate(input)}
          isPending={createMutation.isPending}
        />
      )}

      {confirmProject && (
        <Modal
          title={t('applications.resetModalTitle')}
          description={t('applications.resetModalDescription', {
            name: confirmProject.name,
          })}
          onClose={() => setConfirmProject(null)}
          size="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmProject(null)}>
                {t('applications.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={regenerateMutation.isPending}
                onClick={() => regenerateMutation.mutate(confirmProject.id)}
              >
                {regenerateMutation.isPending
                  ? t('applications.resetting')
                  : t('applications.confirmReset')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t('applications.resetModalBody')}
          </p>
        </Modal>
      )}
    </div>
  );
}

function ApiKeyBanner({
  tone,
  title,
  description,
  apiKey,
  onCopy,
  onDismiss,
}: {
  tone: 'success' | 'warning';
  title: string;
  description: string;
  apiKey: string;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation('content');
  const styles =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/10'
      : 'border-accent-200 bg-accent-50/80 dark:border-accent-500/25 dark:bg-accent-500/10';
  const titleColor =
    tone === 'success'
      ? 'text-emerald-800 dark:text-emerald-300'
      : 'text-accent-700 dark:text-accent-300';
  return (
    <div className={`animate-fade-up rounded-xl border p-4 ${styles}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${titleColor}`}>{title}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
          <code className="mt-2 block max-w-full overflow-x-auto rounded-lg bg-surface-0 px-3 py-2 font-mono text-xs text-gray-800 ring-1 ring-surface-3 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700">
            {apiKey}
          </code>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onCopy}>
            {t('applications.copyKey')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t('applications.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateProjectModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (input: { name: string; slug?: string }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('content');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), slug: slug.trim() || undefined });
  };

  return (
    <Modal
      title={t('applications.createModalTitle')}
      description={t('applications.createModalDescription')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('applications.cancel')}
          </Button>
          <Button size="sm" type="submit" form="create-project-form" disabled={isPending || !name.trim()}>
            {isPending ? t('applications.creating') : t('applications.createProject')}
          </Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
            {t('applications.nameLabel')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('applications.namePlaceholder')}
            required
            autoFocus
            className="h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
            {t('applications.slugLabel')}
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t('applications.slugPlaceholder')}
            className="h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-3 font-mono text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
          />
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            {t('applications.slugHint')}
          </p>
        </div>
      </form>
    </Modal>
  );
}
