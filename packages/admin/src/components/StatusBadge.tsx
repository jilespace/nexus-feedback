import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui';
import { STATUS_META, statusLabel } from '@/utils/labels';
import type { FeedbackStatus } from '@/types';

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  const { i18n } = useTranslation();
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      {statusLabel(status, i18n.language)}
    </Badge>
  );
}
