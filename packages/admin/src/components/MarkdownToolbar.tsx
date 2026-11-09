import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

type ToolbarAction = {
  key: string;
  label: string;
  wrap?: [string, string];
  prefix?: string;
};

export function MarkdownToolbar({
  onInsert,
}: {
  onInsert: (text: string, cursorOffset: number) => void;
}) {
  const { t } = useTranslation();
  const actions: ToolbarAction[] = [
    { key: 'heading', label: t('common.markdown.heading'), prefix: t('common.markdown.headingTemplate') },
    { key: 'bold', label: t('common.markdown.bold'), wrap: ['**', '**'] },
    { key: 'link', label: t('common.markdown.link'), prefix: t('common.markdown.linkTemplate') },
    { key: 'code', label: t('common.markdown.code'), wrap: ['\n```\n', '\n```\n'] },
  ];
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {actionsRef.current.map((action) => (
        <button
          key={action.key}
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
      <span className="ml-auto text-xs text-gray-400">{t('common.markdown.hint')}</span>
    </div>
  );
}
