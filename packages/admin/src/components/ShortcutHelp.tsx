interface ShortcutHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: '/', description: '搜索' },
  { keys: 'J', description: '下一项' },
  { keys: 'K', description: '上一项' },
  { keys: 'Enter', description: '打开选中项' },
  { keys: '?', description: '显示快捷键帮助' },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-xl border border-surface-3 bg-surface-0 p-6 shadow-xl dark:border-gray-600 dark:bg-gray-800">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
          快捷键
        </h2>
        <div className="space-y-3">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {s.description}
              </span>
              <kbd className="rounded-md border border-surface-3 bg-surface-1 px-2 py-0.5 text-xs font-mono text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-surface-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-surface-3 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
