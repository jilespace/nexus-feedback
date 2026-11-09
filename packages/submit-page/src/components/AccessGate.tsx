import { ArrowRightIcon, ClockIcon, LockIcon, SpinnerIcon, XCircleIcon } from './Icons';

type AccessGateProps = {
  status: 'checking' | 'missing' | 'invalid';
  message?: string;
  rateLimited?: boolean;
  onRetry?: () => void;
};

const SKELETON_FIELDS = [0, 1, 2];

export function AccessGate({ status, message, rateLimited = false, onRetry }: AccessGateProps) {
  if (status === 'checking') {
    return (
      <div className="nf-card overflow-hidden" aria-busy="true">
        <div className="border-b border-line px-6 py-5 sm:px-7">
          <div className="nf-skeleton h-3 w-20 rounded" />
          <div className="nf-skeleton mt-3 h-6 w-56 rounded" />
          <div className="nf-skeleton mt-2.5 h-3 w-72 max-w-full rounded" />
        </div>
        <div className="space-y-5 px-6 py-6 sm:px-7">
          {SKELETON_FIELDS.map((index) => (
            <div key={index}>
              <div className="nf-skeleton h-3 w-16 rounded" />
              <div className="nf-skeleton mt-2 h-10 w-full rounded-field" />
            </div>
          ))}
          <p className="flex items-center gap-2 text-[12px] text-ink-3" role="status">
            <SpinnerIcon className="h-3.5 w-3.5 text-brand-600" />
            正在校验访问链接…
          </p>
        </div>
      </div>
    );
  }

  if (status === 'missing') {
    const sampleUrl = `${window.location.origin}${window.location.pathname}?key=…`;
    return (
      <div className="nf-card animate-fade-up px-6 py-9 sm:px-9">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/25 bg-accent-50 text-accent-700">
            <LockIcon className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.01em] text-ink-1">链接中缺少访问密钥</h2>
          <p className="mt-2 max-w-[380px] text-[13px] leading-6 text-ink-2">
            这个页面需要一个项目访问密钥才能打开。请使用项目设置中复制的完整链接访问。
          </p>

          <div className="mt-5 w-full rounded-field border border-line bg-surface-subtle px-4 py-3 text-left">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">正确的链接格式</p>
            <p className="mt-1.5 break-all font-mono text-[12px] leading-5 text-ink-2">{sampleUrl}</p>
          </div>

          <p className="mt-4 text-[11.5px] leading-5 text-ink-3">
            没有可用的链接？请联系项目管理员在「项目设置 → 接入」中重新复制公开提交页地址。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="nf-card animate-fade-up px-6 py-9 sm:px-9">
      <div className="flex flex-col items-center text-center">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full border ${
            rateLimited
              ? 'border-accent/25 bg-accent-50 text-accent-700'
              : 'border-danger-500/25 bg-danger-50 text-danger-600'
          }`}
        >
          {rateLimited ? <ClockIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
        </span>
        <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.01em] text-ink-1">
          {rateLimited ? '访问过于频繁' : '无法访问此页面'}
        </h2>
        <p className="mt-2 max-w-[380px] text-[13px] leading-6 text-ink-2">
          {message || '链接无效或已过期，请确认后再试。'}
        </p>

        {rateLimited ? (
          <p className="mt-5 text-[12px] leading-5 text-ink-3">
            这是临时的访问频率限制，稍等几分钟后点击「重新校验链接」即可。
          </p>
        ) : (
          <div className="mt-5 w-full rounded-field border border-line bg-surface-subtle px-4 py-3 text-left">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">可能的原因</p>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-5 text-ink-2">
              <li>· 链接不完整，或密钥在复制时被截断</li>
              <li>· 项目已重新生成 API Key，旧链接因此失效</li>
              <li>· 访问过于频繁被暂时限制，可稍后重试</li>
            </ul>
          </div>
        )}

        <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          {onRetry && (
            <button type="button" onClick={onRetry} className="nf-btn-secondary h-10 px-4">
              重新校验链接
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
          <a href="mailto:?subject=需要新的反馈提交链接" className="nf-btn-ghost h-10 px-4 text-[12.5px]">
            联系管理员获取新链接
          </a>
        </div>
      </div>
    </div>
  );
}
