import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchProjectCategories,
  submitFeedback,
} from '../api';
import type { ProjectCategory } from '../types';
import { categoryColor, categoryLabel } from '../lib/labels';
import { AlertIcon, CheckIcon, CloseIcon, SpinnerIcon } from './Icons';

const EMAIL_STORAGE_KEY = 'voter_email';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubmitModalProps {
  onClose: () => void;
  onSubmitted: () => void;
}

interface FieldErrors {
  email?: string;
  title?: string;
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

function fieldClass(invalid: boolean): string {
  return invalid
    ? 'field border-danger focus:border-danger focus:ring-danger/15'
    : 'field';
}

export function SubmitModal({ onClose, onSubmitted }: SubmitModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('feature');
  const [email, setEmail] = useState(readEmail);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;
    void fetchProjectCategories().then((list) => {
      if (!active) return;
      setCategories(list);
      setCategory((current) =>
        list.some((item) => item.name === current)
          ? current
          : (list[0]?.name ?? current),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    initialFocusRef.current?.focus();
    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function validate(): FieldErrors | null {
    const next: FieldErrors = {};
    if (!title.trim()) next.title = t('submit.errorRequired');
    if (!content.trim()) next.content = t('submit.errorRequired');
    if (!email.trim()) next.email = t('submit.errorRequired');
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = t('submit.errorEmail');
    setFieldErrors(next);
    return Object.keys(next).length === 0 ? null : next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate();
    if (errors) {
      if (errors.email) emailRef.current?.focus();
      else if (errors.title) initialFocusRef.current?.focus();
      else contentRef.current?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      writeEmail(email.trim());
      await submitFeedback({
        title: title.trim(),
        content: content.trim(),
        category,
        email: email.trim(),
      });
      setSuccess(true);
      onSubmitted();
    } catch {
      setError(t('submit.errorSubmit'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={handleBackdropMouseDown}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        aria-describedby="submit-modal-description"
        className="relative flex max-h-[92vh] w-full animate-pop-in flex-col overflow-hidden rounded-t-pop border border-line-subtle bg-surface shadow-pop sm:max-w-lg sm:rounded-pop"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-subtle px-5 py-4">
          <div className="min-w-0">
            <h2
              id="submit-modal-title"
              className="text-16 font-semibold text-ink"
            >
              {t('submit.title')}
            </h2>
            <p
              id="submit-modal-description"
              className="mt-0.5 text-12 text-ink-secondary"
            >
              {t('submit.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn -mr-1 -mt-0.5 h-8 w-8"
            aria-label={t('common.close')}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-success/20 bg-success/10 text-success">
              <CheckIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-16 font-semibold text-ink">
              {t('submit.successTitle')}
            </h3>
            <p className="mt-1.5 max-w-sm text-13 leading-relaxed text-ink-secondary">
              {t('submit.successDescription')}
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-6">
              {t('submit.successDone')}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          >
            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-12 text-danger"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="submit-email"
                  className="mb-1.5 block text-12 font-medium text-ink"
                >
                  {t('submit.email')}
                  <span className="ml-0.5 text-danger">*</span>
                </label>
                <input
                  id="submit-email"
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      email: undefined,
                    }));
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby="submit-email-help"
                  placeholder="you@example.com"
                  className={fieldClass(Boolean(fieldErrors.email))}
                  autoComplete="email"
                />
                <p
                  id="submit-email-help"
                  className={`mt-1 text-11 ${fieldErrors.email ? 'text-danger' : 'text-ink-tertiary'}`}
                >
                  {fieldErrors.email ?? t('submit.emailHint')}
                </p>
              </div>

              <div>
                <label
                  htmlFor="submit-title"
                  className="mb-1.5 block text-12 font-medium text-ink"
                >
                  {t('submit.titleLabel')}
                  <span className="ml-0.5 text-danger">*</span>
                </label>
                <input
                  id="submit-title"
                  ref={initialFocusRef}
                  type="text"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      title: undefined,
                    }));
                  }}
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={
                    fieldErrors.title ? 'submit-title-error' : undefined
                  }
                  placeholder={t('submit.titlePlaceholder')}
                  className={fieldClass(Boolean(fieldErrors.title))}
                  maxLength={200}
                />
                {fieldErrors.title && (
                  <p
                    id="submit-title-error"
                    className="mt-1 text-11 text-danger"
                  >
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              <div>
                <span className="mb-1.5 block text-12 font-medium text-ink">
                  {t('submit.category')}
                </span>
                <div
                  role="group"
                  aria-label={t('submit.category')}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  {categories.map((item) => {
                    const active = category === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCategory(item.name)}
                        aria-pressed={active}
                        className={`flex h-9 items-center gap-2 rounded-control border px-2.5 text-12 font-medium transition-colors duration-150 ${
                          active
                            ? 'border-brand/40 bg-brand-soft text-brand'
                            : 'border-line-subtle bg-surface text-ink-secondary hover:border-line-strong hover:text-ink'
                        }`}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: categoryColor(item.name) }}
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {categoryLabel(t, item.name)}
                        </span>
                        {active && (
                          <CheckIcon className="ml-auto h-3.5 w-3.5 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="submit-content"
                  className="mb-1.5 block text-12 font-medium text-ink"
                >
                  {t('submit.content')}
                  <span className="ml-0.5 text-danger">*</span>
                </label>
                <textarea
                  id="submit-content"
                  ref={contentRef}
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      content: undefined,
                    }));
                  }}
                  aria-invalid={Boolean(fieldErrors.content)}
                  aria-describedby={
                    fieldErrors.content ? 'submit-content-error' : undefined
                  }
                  rows={4}
                  placeholder={t('submit.contentPlaceholder')}
                  className={`field-area ${fieldErrors.content ? 'border-danger focus:border-danger focus:ring-danger/15' : ''}`}
                />
                {fieldErrors.content && (
                  <p
                    id="submit-content-error"
                    className="mt-1 text-11 text-danger"
                  >
                    {fieldErrors.content}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-line-subtle pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading && <SpinnerIcon className="h-3.5 w-3.5" />}
                {loading ? t('submit.submitting') : t('submit.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
