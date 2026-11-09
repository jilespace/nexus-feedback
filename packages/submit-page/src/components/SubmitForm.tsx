import { useEffect, useMemo, useState } from 'react';
import { ApiError, createFeedback, fetchCategories, type SubmitResult } from '../lib/api';
import { buildCategoryOptions, type CategoryOption } from '../lib/categories';
import { MAX_CONTENT } from '../lib/files';
import { useAttachments } from '../hooks/useAttachments';
import { AttachmentField } from './AttachmentField';
import { CategoryPicker } from './CategoryPicker';
import { FormField } from './FormField';
import { ChatMarkIcon, LockIcon, SpinnerIcon } from './Icons';
import { PriorityPicker, type Priority } from './PriorityPicker';
import { SubmitErrorPanel } from './SubmitErrorPanel';
import { SubmitSuccess } from './SubmitSuccess';

type SubmitFormProps = {
  apiUrl: string;
  apiKey: string;
  projectSlug: string;
  projectName?: string;
  boardUrl?: string;
};

type FieldErrors = {
  title?: string;
  content?: string;
};

type SubmitFailure = {
  message: string;
  rateLimited: boolean;
};

export function SubmitForm({ apiUrl, apiKey, projectSlug, projectName, boardUrl }: SubmitFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('bug');
  const [priority, setPriority] = useState<Priority>('medium');
  const [contact, setContact] = useState('');
  const [touched, setTouched] = useState<{ title: boolean; content: boolean }>({
    title: false,
    content: false,
  });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const attachments = useAttachments(apiUrl, apiKey);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(apiUrl, projectSlug, controller.signal)
      .then((remote) => {
        const options = buildCategoryOptions(remote);
        setCategories(options);
        setCategory((current) =>
          options.some((option) => option.name === current) ? current : (options[0]?.name ?? 'bug'),
        );
      })
      .catch(() => {
        /* 分类加载失败时保留默认值，不阻塞提交流程 */
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoading(false);
      });
    return () => controller.abort();
  }, [apiUrl, projectSlug]);

  const errors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {};
    if (touched.title && !title.trim()) next.title = '请填写标题，帮助团队快速了解问题';
    if (touched.content) {
      if (!content.trim()) next.content = '请补充详细描述，说明发生了什么';
      else if (content.length > MAX_CONTENT) next.content = `超出 ${content.length - MAX_CONTENT} 字，请精简后再提交`;
    }
    return next;
  }, [touched, title, content]);

  const focusFirstInvalid = () => {
    if (!title.trim()) {
      document.getElementById('feedback-title')?.focus();
      return;
    }
    if (!content.trim() || content.length > MAX_CONTENT) {
      document.getElementById('feedback-content')?.focus();
    }
  };

  const submit = async () => {
    setTouched({ title: true, content: true });
    setFailure(null);

    if (!title.trim() || !content.trim() || content.length > MAX_CONTENT) {
      focusFirstInvalid();
      return;
    }
    if (attachments.uploadingCount > 0) {
      setFailure({ message: '附件仍在上传，请等待上传完成后再提交。', rateLimited: false });
      return;
    }

    setSubmitting(true);
    try {
      const created = await createFeedback(apiUrl, apiKey, {
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        contact: contact.trim() || undefined,
        attachment_ids: attachments.attachmentIds.length > 0 ? attachments.attachmentIds : undefined,
      });
      setResult(created);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      setFailure({
        message: apiError?.message ?? '提交失败，请稍后重试。',
        rateLimited: apiError?.status === 429,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setTitle('');
    setContent('');
    setContact('');
    setPriority('medium');
    setTouched({ title: false, content: false });
    setFailure(null);
    attachments.reset();
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.setTimeout(() => document.getElementById('feedback-title')?.focus(), 0);
  };

  if (result) {
    return (
      <SubmitSuccess
        result={result}
        projectName={projectName}
        boardUrl={boardUrl}
        onReset={resetForm}
      />
    );
  }

  const counterTooLong = content.length > MAX_CONTENT;
  const counterNearLimit = content.length > MAX_CONTENT * 0.9;

  return (
    <section className="nf-card animate-fade-up overflow-hidden">
      <div className="border-b border-line bg-gradient-to-b from-surface to-surface-subtle px-6 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">反馈表单</p>
            <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.015em] text-ink-1">告诉我们发生了什么</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-2">
              约 2 分钟完成，带 <span className="font-semibold text-danger-500">*</span> 的为必填项。
            </p>
          </div>
          <span className="hidden flex-shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-3 sm:inline-flex">
            <LockIcon className="h-3 w-3" />
            仅用于跟进
          </span>
        </div>
      </div>

      <form
        noValidate
        className="px-6 py-6 sm:px-7"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-6">
          <FormField
            id="feedback-title"
            label="标题"
            required
            error={errors.title}
            hint="一句话概括问题或建议，例如「导出 CSV 时中文乱码」"
          >
            <input
              id="feedback-title"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
              placeholder="简要描述你的反馈"
              autoComplete="off"
              className="nf-input h-10"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'feedback-title-error' : undefined}
            />
          </FormField>

          <FormField
            id="feedback-content"
            label="详细描述"
            required
            error={errors.content}
            action={
              <span
                className={`text-[11.5px] tabular-nums ${
                  counterTooLong ? 'font-semibold text-danger-600' : counterNearLimit ? 'text-accent-700' : 'text-ink-3'
                }`}
              >
                {content.length}/{MAX_CONTENT}
              </span>
            }
          >
            <textarea
              id="feedback-content"
              value={content}
              rows={5}
              onChange={(event) => setContent(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
              placeholder="描述你遇到的问题、复现步骤，或你希望的功能。越具体越容易处理。"
              className="nf-input resize-y leading-6"
              aria-invalid={Boolean(errors.content)}
              aria-describedby={errors.content ? 'feedback-content-error' : undefined}
            />
          </FormField>

          <AttachmentField
            files={attachments.files}
            dragOver={attachments.dragOver}
            issue={attachments.issue}
            uploadingCount={attachments.uploadingCount}
            dropHandlers={attachments.dropHandlers}
            onAdd={attachments.addFiles}
            onRemove={attachments.removeFile}
            onRetry={attachments.retryFile}
          />

          <CategoryPicker
            options={categories}
            value={category}
            loading={categoriesLoading}
            onChange={setCategory}
          />

          <PriorityPicker value={priority} onChange={setPriority} />

          <FormField
            id="feedback-contact"
            label="联系方式"
            optional
            hint="如果希望我们跟进处理结果，可以留下邮箱；不会公开展示。"
          >
            <input
              id="feedback-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              inputMode="email"
              className="nf-input h-10"
            />
          </FormField>
        </div>

        {failure && (
          <SubmitErrorPanel message={failure.message} rateLimited={failure.rateLimited} onRetry={() => void submit()} />
        )}

        <div className="mt-6">
          <button type="submit" disabled={submitting} className="nf-btn-primary h-11 w-full text-[14px]">
            {submitting ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                正在提交…
              </>
            ) : (
              <>
                <ChatMarkIcon className="h-4 w-4" />
                提交反馈
              </>
            )}
          </button>
          <p className="mt-2.5 text-center text-[11.5px] leading-5 text-ink-3" role="status">
            {attachments.uploadingCount > 0
              ? '附件上传中，完成后即可提交'
              : attachments.failedCount > 0
                ? '有附件上传失败，可以重试或移除后继续提交'
                : '提交后会进入项目的反馈看板，团队会评估并跟进'}
          </p>
        </div>
      </form>
    </section>
  );
}
