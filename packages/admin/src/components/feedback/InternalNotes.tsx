import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { Button, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

type InternalNote = {
  id: string;
  content: string;
  created_at: string;
  member: { id: string; display_name: string; email: string };
};

export function InternalNotes({ feedbackId }: { feedbackId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { data: notes } = useQuery({
    queryKey: ['notes', feedbackId],
    queryFn: () => apiRequest<InternalNote[]>(`/org/feedback/${feedbackId}/notes`),
    enabled: expanded,
  });

  const addMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest(`/org/feedback/${feedbackId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', feedbackId] });
      setContent('');
      toast.show('备注已添加');
    },
    onError: () => toast.show('添加备注失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest(`/org/feedback/${feedbackId}/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', feedbackId] });
      toast.show('备注已删除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 shadow-card dark:border-gray-700/80 dark:bg-gray-800">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          内部备注
          <span className="rounded-md bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">
            仅团队可见
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={clsx(
            'text-gray-400 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-surface-2 px-5 pb-5 pt-4 dark:border-gray-700/70">
          {notes && notes.length > 0 ? (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-accent-200/70 bg-accent-50/60 p-3 dark:border-accent-500/20 dark:bg-accent-500/10"
              >
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">
                  {note.content}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {note.member?.display_name || '成员'} · {formatRelativeTime(note.created_at)}
                  </p>
                  <button
                    onClick={() => deleteMutation.mutate(note.id)}
                    disabled={deleteMutation.isPending}
                    className="text-[11px] text-gray-400 transition-colors hover:text-rose-500"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="暂无备注" description="给团队留下排查线索或处理进展" className="py-6" />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (content.trim()) addMutation.mutate(content.trim());
            }}
            className="space-y-2"
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="添加内部备注，仅团队成员可见..."
              rows={2}
              className="w-full resize-none rounded-lg border border-surface-3 bg-surface-1/60 px-3 py-2 text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
            />
            <div className="flex justify-end">
              <Button size="sm" type="submit" disabled={!content.trim() || addMutation.isPending}>
                {addMutation.isPending ? '添加中...' : '添加备注'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
