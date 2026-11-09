import { Modal } from '@/components/Modal';

interface ShortcutHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: '⌘ K / Ctrl K', description: '打开命令面板（跳转/搜索/操作）' },
  { keys: '/', description: '聚焦当前页面搜索' },
  { keys: 'J', description: '下一项' },
  { keys: 'K', description: '上一项' },
  { keys: 'Enter', description: '打开选中项' },
  { keys: '?', description: '显示快捷键帮助' },
  { keys: 'Esc', description: '关闭弹层 / 命令面板' },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  return (
    <Modal title="键盘快捷键" onClose={onClose} size="sm">
      <div className="space-y-2.5">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-gray-600 dark:text-gray-300">
              {shortcut.description}
            </span>
            <kbd className="shrink-0 rounded-md border border-surface-3 bg-surface-1 px-2 py-0.5 font-sans text-[11px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
