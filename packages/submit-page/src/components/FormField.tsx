import type { ReactNode } from 'react';
import { AlertCircleIcon } from './Icons';

type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function FormField({ id, label, required, optional, hint, error, action, children }: FormFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-1">
          {label}
          {required && (
            <span className="text-danger-500" aria-hidden>
              *
            </span>
          )}
          {optional && <span className="font-normal text-ink-3">（可选）</span>}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="nf-error-text">
          <AlertCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{hint}</p>
      )}
    </div>
  );
}
