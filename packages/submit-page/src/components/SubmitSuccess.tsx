import { useEffect, useRef } from 'react';
import type { SubmitResult } from '../lib/api';
import { ArrowUpRightIcon, CheckCircleIcon, CheckIcon } from './Icons';

type SubmitSuccessProps = {
  result: SubmitResult;
  projectName?: string;
  boardUrl?: string;
  onReset: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

export function SubmitSuccess({ result, projectName, boardUrl, onReset }: SubmitSuccessProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const statusLabel = STATUS_LABEL[result.status] ?? result.status;

  return (
    <section className="nf-card animate-fade-up overflow-hidden">
      <div className="px-6 py-9 text-center sm:px-10 sm:py-11">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-success-500/25 bg-success-50">
          <CheckIcon className="nf-check-path h-7 w-7 text-success-600" />
        </div>

        <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-success-700">已提交</p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-1.5 text-[22px] font-semibold tracking-[-0.015em] text-ink-1 outline-none"
        >
          反馈已收到
        </h2>
        <p className="mx-auto mt-2.5 max-w-[430px] text-[13px] leading-6 text-ink-2">
          感谢你帮助{projectName ? ` ${projectName} ` : '我们'}变得更好。这条反馈已加入处理队列，产品团队会评估它并安排处理；如果留下联系方式，需要更多信息时我们会联系你。
        </p>

        <div className="mt-6 flex flex-col gap-2.5 rounded-field border border-line bg-surface-subtle px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">反馈编号</p>
            <p className="mt-1 truncate font-mono text-[12px] text-ink-2" title={result.id}>
              {result.id}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {statusLabel}
          </span>
        </div>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-center">
          {boardUrl && (
            <a href={boardUrl} target="_blank" rel="noreferrer" className="nf-btn-primary h-10 px-5">
              查看公开看板
              <ArrowUpRightIcon className="h-4 w-4" />
            </a>
          )}
          <button type="button" onClick={onReset} className="nf-btn-secondary h-10 px-5">
            继续提交
          </button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-3">
          <CheckCircleIcon className="h-3.5 w-3.5 text-ink-3" />
          需要补充信息？直接再提交一条即可
        </p>
      </div>
    </section>
  );
}
