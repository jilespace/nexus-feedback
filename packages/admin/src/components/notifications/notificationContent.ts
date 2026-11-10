import type { TFunction } from 'i18next';
import { statusLabel } from '@/utils/labels';
import type { FeedbackStatus } from '@/types';

type NotificationsTranslate = TFunction<'notifications'>;

export type LocalizableNotification = {
  type: string;
  title: string;
  body?: string | null;
  params?: unknown;
};

export type RenderableNotificationContent = {
  title: string;
  body: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readParam(params: Record<string, unknown>, key: string): string | null {
  const value = params[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Renders notification title/body from structured `type + params` in the active language.
 * Notifications created before the params migration (or unknown types) fall back to the
 * server-rendered title/body, so old rows keep working.
 */
export function renderNotificationContent(
  item: LocalizableNotification,
  t: NotificationsTranslate,
  language: string,
): RenderableNotificationContent {
  const fallback: RenderableNotificationContent = {
    title: item.title,
    body: item.body ?? null,
  };

  const params = isPlainObject(item.params) ? item.params : null;
  if (!params) return fallback;

  const feedbackTitle = readParam(params, 'feedback_title');
  if (!feedbackTitle) return fallback;

  switch (item.type) {
    case 'feedback.created': {
      const projectName = readParam(params, 'project_name');
      return {
        title: t('content.created.title', { title: feedbackTitle }),
        body: projectName
          ? t('content.created.body', { project: projectName })
          : t('content.created.bodyFallback'),
      };
    }
    case 'feedback.assigned': {
      const actorName = readParam(params, 'actor_name');
      return {
        title: t('content.assigned.title', { title: feedbackTitle }),
        body: actorName
          ? t('content.assigned.bodyBy', { actor: actorName })
          : t('content.assigned.body'),
      };
    }
    case 'feedback.status_changed': {
      const fromStatus = readParam(params, 'from_status');
      const toStatus = readParam(params, 'to_status');
      if (!fromStatus || !toStatus) return fallback;
      return {
        title: t('content.statusChanged.title', { title: feedbackTitle }),
        body: t('content.statusChanged.body', {
          from: statusLabel(fromStatus as FeedbackStatus, language),
          to: statusLabel(toStatus as FeedbackStatus, language),
        }),
      };
    }
    case 'feedback.comment': {
      const actorName = readParam(params, 'actor_name');
      return {
        title: t('content.comment.title', { title: feedbackTitle }),
        body: actorName
          ? t('content.comment.bodyBy', { actor: actorName })
          : t('content.comment.body'),
      };
    }
    default:
      return fallback;
  }
}
