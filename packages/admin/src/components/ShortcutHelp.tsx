import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/Modal';

interface ShortcutHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: '⌘ K / Ctrl K', labelKey: 'shell.shortcut_command_palette' },
  { keys: '/', labelKey: 'shell.shortcut_focus_search' },
  { keys: 'J', labelKey: 'shell.shortcut_next' },
  { keys: 'K', labelKey: 'shell.shortcut_prev' },
  { keys: 'Enter', labelKey: 'shell.shortcut_open' },
  { keys: '?', labelKey: 'shell.shortcut_help' },
  { keys: 'Esc', labelKey: 'shell.shortcut_close' },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const { t } = useTranslation();
  return (
    <Modal title={t('shell.shortcuts_title')} onClose={onClose} size="sm">
      <div className="space-y-2.5">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-gray-600 dark:text-gray-300">
              {t(shortcut.labelKey)}
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
