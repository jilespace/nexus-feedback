import { useEffect, useRef, useState } from 'react';
import { fetchProjectCategories, ProjectCategory, FeedbackPayload, FeedbackPriority } from './api';
import { t, categoryLabel, Locale } from './i18n';
import { PrioritySelector } from './PrioritySelector';
import {
  AlertIcon,
  CheckCircleIcon,
  FileIcon,
  SendIcon,
  SpinnerIcon,
  UploadIcon,
  XIcon,
} from './icons';

type FeedbackFormProps = {
  apiKey: string;
  apiUrl: string;
  locale: Locale;
  projectSlug?: string | null;
  showCategory: boolean;
  showPriority: boolean;
  showContact: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
};

type FileEntry = {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;
const MAX_CONTENT = 500;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FeedbackForm({
  apiKey,
  apiUrl,
  locale,
  projectSlug,
  showCategory,
  showPriority,
  showContact,
  onSuccess,
  onError,
}: FeedbackFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('bug');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<{ title: boolean; content: boolean }>({
    title: false,
    content: false,
  });
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [attachIssue, setAttachIssue] = useState<string | null>(null);
  const [submitIssue, setSubmitIssue] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(showCategory);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showCategory) {
      setCategoryLoading(false);
      return;
    }
    let cancelled = false;
    setCategoryLoading(true);
    fetchProjectCategories(apiUrl, projectSlug).then((items) => {
      if (cancelled) return;
      setCategories(items);
      setCategoryLoading(false);
      setCategory((current) => (items.some((item) => item.name === current) ? current : (items[0]?.name ?? 'other')));
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, projectSlug, showCategory]);

  const errors: Record<string, string> = {};
  if (touched.title && !title.trim()) errors.title = t(locale, 'titleRequired');
  if (touched.content && !content.trim()) errors.content = t(locale, 'descriptionRequired');
  if (content.length > MAX_CONTENT) errors.content = t(locale, 'charLimit');

  const uploadEntry = async (entry: FileEntry) => {
    const formData = new FormData();
    formData.append('file', entry.file);
    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || json.code !== 0) throw new Error(json.message || t(locale, 'uploadFailed'));
      setFiles((prev) =>
        prev.map((item) =>
          item.id === entry.id ? { ...item, id: json.data.id as string, status: 'done' as const, error: undefined } : item,
        ),
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? { ...item, status: 'error' as const, error: err instanceof Error ? err.message : t(locale, 'uploadFailed') }
            : item,
        ),
      );
    }
  };

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) {
      setAttachIssue(t(locale, 'attachLimit'));
      return;
    }

    const accepted: FileEntry[] = [];
    let firstIssue: string | null = null;
    for (const file of list.slice(0, remaining)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        firstIssue = firstIssue ?? `${file.name}: ${t(locale, 'fileTypeNotSupported')}`;
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        firstIssue = firstIssue ?? `${file.name}: ${t(locale, 'fileTooLarge')}`;
        continue;
      }
      accepted.push({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: file.size,
        status: 'uploading',
      });
    }

    setAttachIssue(firstIssue);
    if (accepted.length === 0) return;
    setFiles((prev) => [...prev, ...accepted]);
    for (const entry of accepted) void uploadEntry(entry);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const retryFile = (id: string) => {
    const target = files.find((item) => item.id === id);
    if (!target || target.status !== 'error') return;
    const retried: FileEntry = { ...target, status: 'uploading', error: undefined };
    setFiles((prev) => prev.map((item) => (item.id === id ? retried : item)));
    void uploadEntry(retried);
  };

  const uploadingCount = files.filter((item) => item.status === 'uploading').length;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ title: true, content: true });
    setSubmitIssue(null);

    if (!title.trim() || !content.trim() || content.length > MAX_CONTENT) return;
    if (uploadingCount > 0) {
      setSubmitIssue(t(locale, 'uploadingBlocked'));
      return;
    }

    setLoading(true);
    try {
      const payload: FeedbackPayload = {
        title: title.trim(),
        content: content.trim(),
        category,
        priority: showPriority ? priority : undefined,
        contact: showContact ? contact.trim() || undefined : undefined,
        attachment_ids: files.filter((item) => item.status === 'done').map((item) => item.id),
        source: 'widget',
      };
      const res = await fetch(`${apiUrl}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.code !== 0) throw new Error(json.message || t(locale, 'submitFailed'));
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : t(locale, 'submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="nf-form" onSubmit={handleSubmit} noValidate>
      <div className="nf-field">
        <label className="nf-label" htmlFor="nf-title">
          {t(locale, 'title')}
          <span className="nf-counter">{title.length}/200</span>
        </label>
        <input
          id="nf-title"
          className="nf-input"
          data-autofocus="true"
          value={title}
          maxLength={200}
          placeholder={t(locale, 'titlePlaceholder')}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && (
          <span className="nf-error">
            <AlertIcon />
            {errors.title}
          </span>
        )}
      </div>

      <div className="nf-field">
        <label className="nf-label" htmlFor="nf-content">
          {t(locale, 'description')}
          <span className="nf-counter" data-over={content.length > MAX_CONTENT}>
            {content.length}/{MAX_CONTENT}
          </span>
        </label>
        <textarea
          id="nf-content"
          className="nf-textarea"
          value={content}
          rows={3}
          placeholder={t(locale, 'descriptionPlaceholder')}
          onChange={(event) => setContent(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
          aria-invalid={Boolean(errors.content)}
        />
        {errors.content && (
          <span className="nf-error">
            <AlertIcon />
            {errors.content}
          </span>
        )}
      </div>

      <div className="nf-field">
        <div className="nf-attach-bar">
          <span className="nf-label">{t(locale, 'attachment')}</span>
          <span className="nf-attach-count">
            {files.length}/{MAX_FILES}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={(event) => {
            if (event.target.files?.length) addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="nf-attach-btn"
          data-drag={dragOver}
          disabled={files.length >= MAX_FILES}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
          }}
        >
          <UploadIcon />
          {files.length >= MAX_FILES ? t(locale, 'attachLimit') : t(locale, 'attachAction')}
          <span style={{ color: 'inherit', opacity: 0.7, fontSize: 10.5 }}>· {t(locale, 'attachHint')}</span>
        </button>
        {files.length > 0 && (
          <div className="nf-file-list">
            {files.map((entry) => (
              <div className="nf-file" key={entry.id} data-status={entry.status}>
                <span className="nf-file-icon">
                  {entry.status === 'done' ? (
                    <CheckCircleIcon />
                  ) : entry.status === 'uploading' ? (
                    <SpinnerIcon />
                  ) : (
                    <FileIcon />
                  )}
                </span>
                <span className="nf-file-main">
                  <span className="nf-file-name">{entry.name}</span>
                  <span className="nf-file-meta">
                    {formatFileSize(entry.size)} ·{' '}
                    {entry.status === 'uploading' && t(locale, 'uploading')}
                    {entry.status === 'done' && t(locale, 'attached')}
                    {entry.status === 'error' && (entry.error || t(locale, 'uploadFailed'))}
                  </span>
                </span>
                {entry.status === 'error' && (
                  <button type="button" className="nf-file-retry" onClick={() => retryFile(entry.id)}>
                    {t(locale, 'retryUpload')}
                  </button>
                )}
                <button
                  type="button"
                  className="nf-icon-btn"
                  onClick={() => removeFile(entry.id)}
                  aria-label={`${t(locale, 'remove')} ${entry.name}`}
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        )}
        {attachIssue && (
          <span className="nf-error">
            <AlertIcon />
            {attachIssue}
          </span>
        )}
      </div>

      {showCategory && (
        <div className="nf-field">
          <span className="nf-label">{t(locale, 'category')}</span>
          <div className="nf-chips">
            {categoryLoading
              ? [0, 1, 2].map((index) => <span className="nf-chip-skeleton" key={index} />)
              : categories.map((item) => (
                  <button
                    type="button"
                    key={item.name}
                    className="nf-chip"
                    data-selected={category === item.name}
                    aria-pressed={category === item.name}
                    onClick={() => setCategory(item.name)}
                  >
                    <span className="nf-chip-dot" style={{ color: item.color }} />
                    {categoryLabel(locale, item.name)}
                  </button>
                ))}
          </div>
        </div>
      )}

      {showPriority && <PrioritySelector value={priority} locale={locale} onChange={setPriority} />}

      {showContact && (
        <div className="nf-field">
          <label className="nf-label" htmlFor="nf-contact">
            {t(locale, 'contact')}
            <span className="nf-label-optional">{t(locale, 'optional')}</span>
          </label>
          <input
            id="nf-contact"
            className="nf-input"
            value={contact}
            placeholder={t(locale, 'contactPlaceholder')}
            autoComplete="email"
            onChange={(event) => setContact(event.target.value)}
          />
        </div>
      )}

      <div className="nf-form-actions">
        <button type="submit" className="nf-submit" disabled={loading}>
          {loading ? <SpinnerIcon /> : <SendIcon />}
          {loading ? t(locale, 'submitting') : t(locale, 'submit')}
        </button>

        {submitIssue ? (
          <p className="nf-error" role="alert" style={{ justifyContent: 'center' }}>
            <AlertIcon />
            {submitIssue}
          </p>
        ) : (
          <p className="nf-form-note">{t(locale, 'submitHint')}</p>
        )}
      </div>
    </form>
  );
}
