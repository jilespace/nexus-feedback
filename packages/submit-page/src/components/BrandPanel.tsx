import { ArrowUpRightIcon, EyeIcon, InboxIcon, ShieldIcon } from './Icons';

type BrandPanelProps = {
  projectName?: string;
  boardUrl?: string;
};

const TRUST_POINTS = [
  {
    icon: InboxIcon,
    title: '每一条都会被阅读',
    detail: '产品团队会逐条评估，而不是只看数量',
  },
  {
    icon: EyeIcon,
    title: '进展公开可见',
    detail: '在公开看板上查看状态变更与团队回复',
  },
  {
    icon: ShieldIcon,
    title: '联系方式不公开',
    detail: '仅用于必要时的问题澄清，不会展示给其他人',
  },
];

const NEXT_STEPS = [
  { title: '提交反馈', detail: '描述越具体，越容易定位问题' },
  { title: '团队评估', detail: '归类、确认优先级并安排处理' },
  { title: '进展同步', detail: '在看板上查看状态更新与回复' },
];

function ProjectAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'N';
  return (
    <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-semibold text-white shadow-[0_6px_16px_-6px_rgb(61_90_254_/_0.55)]">
      {initial}
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas bg-success-500" aria-hidden />
    </div>
  );
}

export function BrandPanel({ projectName, boardUrl }: BrandPanelProps) {
  const name = projectName ?? 'Nexus Feedback';

  return (
    <>
      {/* 移动端：紧凑品牌条 */}
      <div className="lg:hidden">
        <div className="flex items-center gap-3">
          <ProjectAvatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600">Nexus Feedback</p>
            <p className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em] text-ink-1">{name}</p>
            <p className="mt-0.5 truncate text-xs text-ink-2">把问题、建议和想法告诉我们</p>
          </div>
          {boardUrl && (
            <a
              href={boardUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-card transition-colors hover:border-brand-100 hover:text-brand-600"
              aria-label="查看公开看板"
              title="查看公开看板"
            >
              <ArrowUpRightIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* 桌面端：品牌说明区 */}
      <aside className="hidden lg:flex lg:max-w-[460px] lg:flex-col lg:gap-10">
        <div>
          <div className="flex items-center gap-3.5">
            <ProjectAvatar name={name} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Nexus Feedback</p>
              <h1 className="mt-1 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-1">{name}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-[430px] text-[15px] leading-7 text-ink-2">
            把你在使用中遇到的问题、希望拥有的功能和任何想法告诉我们。每条反馈都会被记录、评估，并在公开看板同步进展。
          </p>
        </div>

        <ul className="space-y-4">
          {TRUST_POINTS.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface text-brand-600 shadow-card">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink-1">{title}</p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-ink-3">{detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-card border border-line bg-surface-subtle p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">接下来会发生什么</p>
          <ol className="mt-4 space-y-3.5">
            {NEXT_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10.5px] font-semibold text-ink-2 tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[13px] font-semibold leading-5 text-ink-1">{step.title}</p>
                  <p className="text-[12.5px] leading-5 text-ink-3">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {boardUrl && (
          <a
            href={boardUrl}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex w-fit items-center gap-2 text-[13.5px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            先去公开看板看看
            <ArrowUpRightIcon className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        )}
      </aside>
    </>
  );
}
