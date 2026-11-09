import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest, fetchProjectCategories } from '@/api/client';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { categoryLabel, priorityLabel } from '@/utils/labels';
import type { FeedbackDetail, FeedbackPriority } from '@/types';

const PRIORITIES: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];

const inputClass =
  'h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-3 text-[13px] text-gray-900 placeholder:text-gray-400 transition-colors focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100';

interface EditFeedbackProps {
  feedback: FeedbackDetail;
  onClose: () => void;
}

export function EditFeedback({ feedback, onClose }: EditFeedbackProps) {
  const { i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(feedback.title);
  const [content, setContent] = useState(feedback.content);
  const [category, setCategory] = useState(feedback.category);
  const [priority, setPriority] = useState<FeedbackPriority>(feedback.priority);
  const [contact, setContact] = useState(feedback.contact ?? '');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: fetchProjectCategories,
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest(`/admin/feedback/${feedback.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', feedback.id] });
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.show('反馈已更新');
      onClose();
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const submit = () => {
    const nextErrors: { title?: string; content?: string } = {};
    if (!title.trim()) nextErrors.title = '标题不能为空';
    if (!content.trim()) nextErrors.content = '描述不能为空';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload: Record<string, unknown> = {};
    if (title.trim() !== feedback.title) payload.title = title.trim();
    if (content.trim() !== feedback.content) payload.content = content.trim();
    if (category !== feedback.category) payload.category = category;
    if (priority !== feedback.priority) payload.priority = priority;
    if ((contact.trim() || null) !== (feedback.contact ?? null)) {
      payload.contact = contact.trim() || null;
    }
    if (Object.keys(payload).length === 0) {
      toast.show('没有需要保存的修改', 'info');
      onClose();
      return;
    }
    mutation.mutate(payload);
  };

  return (
    <Modal
      title="编辑反馈"
      description="修改会同步到公开看板，建议保留用户原意。"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? '保存中...' : '保存修改'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
            标题
          </label>
          <input
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            className={inputClass}
          />
          {errors.title && <p className="mt-1 text-[11px] text-rose-500">{errors.title}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
            描述
          </label>
          <textarea
            value={content}
            rows={6}
            maxLength={5000}
            onChange={(e) => {
              setContent(e.target.value);
              setErrors((prev) => ({ ...prev, content: undefined }));
            }}
            className="w-full resize-none rounded-lg border border-surface-3 bg-surface-1/60 px-3 py-2.5 text-[13px] leading-relaxed text-gray-900 placeholder:text-gray-400 transition-colors focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.content ? (
              <p className="text-[11px] text-rose-500">{errors.content}</p>
            ) : (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                支持换行，最多 5000 字
              </span>
            )}
            <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
              {content.length}/5000
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
              分类
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {(categories ?? [{ name: feedback.category, color: '' }]).map((item) => (
                <option key={item.name} value={item.name}>
                  {categoryLabel(item.name, i18n.language)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
              优先级
            </label>
            <div className="flex h-9 items-center gap-1 rounded-lg border border-surface-3 bg-surface-1/60 p-1 dark:border-gray-700 dark:bg-gray-900/40">
              {PRIORITIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPriority(item)}
                  className={
                    priority === item
                      ? 'h-full flex-1 rounded-md bg-surface-0 text-[12px] font-medium text-brand-700 shadow-sm dark:bg-gray-700 dark:text-brand-300'
                      : 'h-full flex-1 rounded-md text-[12px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }
                >
                  {priorityLabel(item, i18n.language)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
            联系方式（可选）
          </label>
          <input
            value={contact}
            maxLength={200}
            onChange={(e) => setContact(e.target.value)}
            placeholder="用户邮箱或其他联系方式"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            仅在详情页展示，不会出现在公开看板。
          </p>
        </div>

        <p className="rounded-lg bg-surface-1 px-3 py-2 text-[11px] leading-relaxed text-gray-400 dark:bg-gray-900/30 dark:text-gray-500">
          提示：状态、负责人与标签请使用右侧操作栏管理；修改记录会写入审计日志。
        </p>
      </div>
    </Modal>
  );
}
