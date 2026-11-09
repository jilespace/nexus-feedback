import { useRef, type KeyboardEvent } from 'react';
import type { FeedbackPriority } from './api';
import { priorityLabel, t, Locale } from './i18n';

const OPTIONS: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];

/** 语义色与后台优先级徽标一致；文字始终可见，颜色不是唯一信号。 */
const DOT_COLORS: Record<FeedbackPriority, string> = {
  low: '#94A3B8',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

type PrioritySelectorProps = {
  value: FeedbackPriority;
  locale: Locale;
  onChange: (value: FeedbackPriority) => void;
};

export function PrioritySelector({ value, locale, onChange }: PrioritySelectorProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (next: FeedbackPriority) => {
    onChange(next);
    buttonsRef.current[OPTIONS.indexOf(next)]?.focus();
  };

  // radiogroup 键盘约定：方向键/Home/End 移动并选中，Tab 只停留在当前选项。
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = OPTIONS.indexOf(value);
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % OPTIONS.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + OPTIONS.length) % OPTIONS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = OPTIONS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(OPTIONS[nextIndex]!);
  };

  return (
    <div className="nf-field">
      <span className="nf-label" id="nf-priority-label">
        {t(locale, 'priority')}
      </span>
      <div
        className="nf-segmented"
        role="radiogroup"
        aria-labelledby="nf-priority-label"
        onKeyDown={handleKeyDown}
      >
        {OPTIONS.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              ref={(element) => {
                buttonsRef.current[OPTIONS.indexOf(option)] = element;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className="nf-segment"
              data-selected={selected}
              onClick={() => onChange(option)}
            >
              <span className="nf-chip-dot" style={{ color: DOT_COLORS[option] }} aria-hidden="true" />
              {priorityLabel(locale, option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
