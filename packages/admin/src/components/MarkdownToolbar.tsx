import { useRef } from 'react';

type ToolbarAction = {
  label: string;
  wrap?: [string, string];
  prefix?: string;
};

const ACTIONS: ToolbarAction[] = [
  { label: '标题', prefix: '\n## 标题\n' },
  { label: '粗体', wrap: ['**', '**'] },
  { label: '链接', prefix: '[文本](url)' },
  { label: '代码', wrap: ['\n```\n', '\n```\n'] },
];

export function MarkdownToolbar({ onInsert }: { onInsert: (text: string, cursorOffset: number) => void }) {
  const actionsRef = useRef(ACTIONS);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {actionsRef.current.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => {
            if (action.wrap) {
              const [open, close] = action.wrap;
              onInsert(open + close, open.length);
            } else if (action.prefix) {
              onInsert(action.prefix, -1);
            }
          }}
          className="rounded-md border border-surface-3 bg-surface-0 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-surface-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          {action.label}
        </button>
      ))}
      <span className="ml-auto text-xs text-gray-400">
        支持 Markdown：## 标题、**粗体**、[链接](url)、代码块
      </span>
    </div>
  );
}
