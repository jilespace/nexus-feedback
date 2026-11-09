import { AlertCircleIcon, ClockIcon } from './Icons';

type SubmitErrorPanelProps = {
  message: string;
  rateLimited: boolean;
  onRetry: () => void;
};

export function SubmitErrorPanel({ message, rateLimited, onRetry }: SubmitErrorPanelProps) {
  return (
    <div
      role="alert"
      className={`mt-5 flex items-start gap-3 rounded-field border px-4 py-3.5 ${
        rateLimited ? 'border-accent/30 bg-accent-50' : 'border-danger-500/30 bg-danger-50'
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
          rateLimited ? 'bg-accent/15 text-accent-700' : 'bg-danger-500/10 text-danger-600'
        }`}
      >
        {rateLimited ? <ClockIcon className="h-3.5 w-3.5" /> : <AlertCircleIcon className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-semibold ${rateLimited ? 'text-accent-700' : 'text-danger-700'}`}>
          {rateLimited ? '提交太频繁了' : '提交失败'}
        </p>
        <p className={`mt-0.5 text-[12.5px] leading-5 ${rateLimited ? 'text-accent-700/90' : 'text-danger-600'}`}>
          {message}
        </p>
        <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
          {rateLimited ? '稍等片刻后重试即可，已填写的内容不会丢失。' : '你的内容已保留，可以直接重试。'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="nf-btn-secondary h-8 flex-shrink-0 self-center px-3 text-[12px]"
      >
        重试
      </button>
    </div>
  );
}
