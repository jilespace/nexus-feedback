/** 写操作链路：通知列表按 type 过滤（含 unread 叠加与非法 type 校验）。 */
import { setTimeout as sleep } from 'node:timers/promises';
import { DEMO_API_KEY, DEMO_PROJECT_SLUG } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';
import { deleteSmokeNotifications } from './cleanup.mjs';

const NOTIFICATION_TYPES = [
  'feedback.created',
  'feedback.assigned',
  'feedback.status_changed',
  'feedback.comment',
];

export async function checkNotificationTypeFilter(options, context) {
  const name = '写操作 · 通知类型过滤';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过通知类型过滤检查');
    return;
  }

  const authHeaders = { Authorization: `Bearer ${context.auth.token}` };
  const projectId = context.projectId;
  void projectId;
  const base = `${options.baseApi}/api/v1`;
  const listByType = (type, suffix = '') =>
    httpJson(
      `${base}/org/notifications?type=${encodeURIComponent(type)}&page_size=100${suffix}`,
      { headers: authHeaders },
    );
  const title = `[SMOKE] 类型过滤 ${Date.now()}`;
  let feedbackId = null;

  const waitForNotification = async (type) => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const response = await listByType(type);
      assert(response.status === 200 && response.json?.code === 0, `${type} 列表 HTTP ${response.status}`);
      if ((response.json?.data?.items ?? []).some((item) => item.feedback_id === feedbackId)) return;
      await sleep(250);
    }
    throw new Error(`等待 ${type} 通知超时（feedback_id=${feedbackId}）`);
  };

  await runCheck(name, async () => {
    try {
      const created = await httpJson(`${base}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DEMO_API_KEY },
        body: JSON.stringify({
          title,
          content: 'pnpm smoke 自动创建的测试反馈，用于验证通知类型过滤。',
          category: 'other',
          priority: 'medium',
          source: 'api',
        }),
      });
      assert(created.status === 201 && created.json?.code === 0, `创建公开反馈失败 HTTP ${created.status}`);
      feedbackId = created.json?.data?.id ?? null;
      assert(feedbackId, '创建公开反馈未返回 id');

      const comment = await httpJson(
        `${base}/public/${DEMO_PROJECT_SLUG}/feedback/${feedbackId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'smoke-type@nexus.test',
            name: 'Smoke',
            content: '类型过滤测试评论。',
          }),
        },
      );
      assert(comment.status === 201 && comment.json?.code === 0, `公开评论失败 HTTP ${comment.status}`);

      await waitForNotification('feedback.created');
      await waitForNotification('feedback.comment');

      const expectedTypes = ['feedback.created', 'feedback.comment'];
      const totals = {};
      for (const type of expectedTypes) {
        const filtered = await listByType(type);
        assert(filtered.status === 200 && filtered.json?.code === 0, `${type} 过滤失败 HTTP ${filtered.status}`);
        const items = filtered.json?.data?.items ?? [];
        assert(items.length > 0, `${type} 过滤结果为空`);
        assert(
          items.every((item) => item.type === type),
          `${type} 过滤结果包含其它类型`,
        );
        const firstPage = await httpJson(
          `${base}/org/notifications?type=${encodeURIComponent(type)}&page_size=1`,
          { headers: authHeaders },
        );
        assert(
          firstPage.json?.data?.total === filtered.json?.data?.total,
          `${type} total 与分页大小不一致（${firstPage.json?.data?.total} vs ${filtered.json?.data?.total}）`,
        );
        totals[type] = filtered.json?.data?.total;
      }
      assert(
        typeof totals['feedback.created'] === 'number' && typeof totals['feedback.comment'] === 'number',
        '过滤结果缺少 total',
      );

      const combined = await httpJson(
        `${base}/org/notifications?unread=true&type=feedback.created&page_size=100`,
        { headers: authHeaders },
      );
      assert(combined.status === 200 && combined.json?.code === 0, `unread+type 查询失败 HTTP ${combined.status}`);
      const combinedItems = combined.json?.data?.items ?? [];
      assert(
        combinedItems.every((item) => item.type === 'feedback.created' && item.read_at === null),
        'unread+type 结果包含已读或其它类型',
      );
      assert(
        combined.json?.data?.total <= totals['feedback.created'],
        'unread+type total 不应大于类型 total',
      );
      assert(
        combinedItems.some((item) => item.feedback_id === feedbackId),
        'unread+type 结果缺少本次测试通知',
      );

      const invalid = await httpJson(`${base}/org/notifications?type=bogus`, {
        headers: authHeaders,
      });
      assert(
        invalid.status === 400 && typeof invalid.json?.code === 'number' && invalid.json.code !== 0,
        `非法 type 未返回 400/code≠0（HTTP ${invalid.status}）`,
      );

      return `created/comment total=${totals['feedback.created']}/${totals['feedback.comment']} · type 过滤一致 · 非法 type 400(code=${invalid.json.code}) · unread+type ✓`;
    } finally {
      if (feedbackId) {
        for (const type of NOTIFICATION_TYPES) {
          try {
            const response = await listByType(type);
            for (const item of response.json?.data?.items ?? []) {
              if (item.feedback_id !== feedbackId) continue;
              try {
                await httpJson(`${base}/org/notifications/${item.id}`, {
                  method: 'DELETE',
                  headers: authHeaders,
                });
              } catch {
                /* 尽力而为 */
              }
            }
          } catch {
            /* 尽力而为 */
          }
        }
        try {
          await httpJson(`${base}/admin/feedback/${feedbackId}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
        } catch {
          /* 尽力而为 */
        }
      }
      await deleteSmokeNotifications(options, context.auth.token).catch(() => {});
    }
  });
}
