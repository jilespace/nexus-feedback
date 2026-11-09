import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { postComment } from '../api';
import { AlertIcon, SpinnerIcon } from './Icons';

const EMAIL_STORAGE_KEY = 'voter_email';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CommentFormProps {
  feedbackId: string;
  onCommented: () => void;
}

interface FieldErrors {
  email?: string;
  content?: string;
}

function readEmail(): string {
  try {
    return localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeEmail(email: string): void {
  try {
    localStorage.setItem(EMAIL_STORAGE_KEY, email);
  } catch {
    /* ignore */
  }
}

export function CommentForm({ feedbackId, onCommented }: CommentFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(readEmail);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = t('submit.errorRequired');
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = t('submit.errorEmail');
    if (!content.trim()) next.content = t('submit.errorRequired');
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      writeEmail(email.trim());
      await postComment(feedbackId, {
        email: email.trim(),
        name: name.trim() || undefined,
        content: content.trim(),
      });
      setContent('');
      onCommented();
    } catch {
      setError(t('comment.errorSubmit'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 sm:p-5">
      <h2 className="text-14 font-semibold text-ink">{t('comment.title')}</h2>
      <p className="mt-0.5 text-11 text-ink-tertiary">{t('comment.hint')}</p>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-12 text-danger"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="comment-email"
              className="mb-1.5 block text-12 font-medium text-ink"
            >
              {t('comment.email')}
              <span className="ml-0.5 text-danger">*</span>
            </label>
            <input
              id="comment-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              placeholder={t('comment.emailPlaceholder')}
              autoComplete="email"
              className={
                fieldErrors.email
                  ? 'field border-danger focus:border-danger focus:ring-danger/15'
                  : 'field'
              }
            />
            {fieldErrors.email && (
              <p className="mt-1 text-11 text-danger">{fieldErrors.email}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="comment-name"
              className="mb-1.5 block text-12 font-medium text-ink"
            >
              {t('comment.name')}
            </label>
            <input
              id="comment-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('comment.namePlaceholder')}
              className="field"
              autoComplete="nickname"
              maxLength={50}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="comment-content"
            className="mb-1.5 block text-12 font-medium text-ink"
          >
            {t('comment.content')}
            <span className="ml-0.5 text-danger">*</span>
          </label>
          <textarea
            id="comment-content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setFieldErrors((current) => ({ ...current, content: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.content)}
            rows={3}
            placeholder={t('comment.contentPlaceholder')}
            className={`field-area ${
              fieldErrors.content
                ? 'border-danger focus:border-danger focus:ring-danger/15'
                : ''
            }`}
          />
          {fieldErrors.content && (
            <p className="mt-1 text-11 text-danger">{fieldErrors.content}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <SpinnerIcon className="h-3.5 w-3.5" />}
          {loading ? t('comment.submitting') : t('comment.submit')}
        </button>
      </div>
    </form>
  );
}
