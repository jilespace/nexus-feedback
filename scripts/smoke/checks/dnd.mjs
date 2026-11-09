/** 通知免打扰：窗口内创建反馈应静默丢弃通知；非法时间被拒绝。 */
import { setTimeout as sleep } from 'node:timers/promises';
import { DEMO_API_KEY } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';
import { deleteSmokeNotifications } from './cleanup.mjs';

export async function checkDnd(options, context) {
  const name = '通知免打扰 · 设置命中时静默丢弃';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过免打扰检查');
    return;
  }

  const authHeaders = { Authorization: `Bearer ${context.auth.token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };
  const settingsUrl = `${options.baseApi}/api/v1/org/notifications/settings`;
  const unreadUrl = `${options.baseApi}/api/v1/org/notifications/unread-count`;
  const dndWindow = { enabled: true, start: '00:00', end: '23:59' };
  let originalDnd = null;
  let feedbackId = null;

  const readUnread = async () => {
    const response = await httpJson(unreadUrl, { headers: authHeaders });
    assert(response.status === 200 && response.json?.code === 0, `unread-count 失败 HTTP ${response.status}`);
    return Number(response.json?.data?.count ?? 0);
  };

  await runCheck(name, async () => {
    try {
      const before = await httpJson(settingsUrl, { headers: authHeaders });
      assert(before.status === 200 && before.json?.code === 0, `读取通知设置 HTTP ${before.status}`);
      originalDnd = before.json?.data?.dnd ?? null;
      assert(
        originalDnd && typeof originalDnd === 'object',
        '通知设置缺少 dnd 字段',
      );

      const put = await httpJson(settingsUrl, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ settings: { dnd: dndWindow } }),
      });
      assert(put.status === 200 && put.json?.code === 0, `开启免打扰失败 HTTP ${put.status}`);
      assert(
        put.json?.data?.dnd?.enabled === true &&
          put.json?.data?.dnd?.start === dndWindow.start &&
          put.json?.data?.dnd?.end === dndWindow.end,
        '免打扰设置未生效',
      );

      const unreadBefore = await readUnread();
      const title = `[SMOKE] 免打扰 ${Date.now()}`;
      const created = await httpJson(`${options.baseApi}/api/v1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DEMO_API_KEY },
        body: JSON.stringify({
          title,
          content: 'pnpm smoke 自动创建的测试反馈，用于验证免打扰期间站内通知被静默丢弃。',
          category: 'other',
          priority: 'medium',
          source: 'api',
        }),
      });
      assert(created.status === 201 && created.json?.code === 0, `创建公开反馈失败 HTTP ${created.status}`);
      feedbackId = created.json?.data?.id ?? null;
      assert(feedbackId, '创建公开反馈未返回 id');

      await sleep(1500);
      const unreadAfter = await readUnread();
      assert(
        unreadAfter === unreadBefore,
        `免打扰期间未读数应保持不变（${unreadBefore} → ${unreadAfter}）`,
      );

      const list = await httpJson(`${options.baseApi}/api/v1/org/notifications?page=1&page_size=20`, {
        headers: authHeaders,
      });
      const hit = (list.json?.data?.items ?? []).some((item) =>
        String(item.title ?? '').includes(title),
      );
      assert(!hit, '免打扰期间仍生成了该测试反馈的站内通知');

      const invalid = await httpJson(settingsUrl, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ settings: { dnd: { enabled: true, start: '25:00', end: '23:59' } } }),
      });
      assert(
        invalid.status === 400 && typeof invalid.json?.code === 'number' && invalid.json.code !== 0,
        `非法免打扰时间未返回 400/code≠0（HTTP ${invalid.status}）`,
      );
      const afterInvalid = await httpJson(settingsUrl, { headers: authHeaders });
      assert(
        afterInvalid.json?.data?.dnd?.start === dndWindow.start,
        '非法免打扰时间不应被写入',
      );
      return `unread ${unreadBefore} 保持不变 · 非法时间 400(code=${invalid.json.code}) · 已软删测试反馈`;
    } finally {
      if (originalDnd) {
        try {
          await httpJson(settingsUrl, {
            method: 'PUT',
            headers: jsonHeaders,
            body: JSON.stringify({ settings: { dnd: originalDnd } }),
          });
        } catch {
          /* 尽力而为 */
        }
      }
      if (feedbackId) {
        try {
          await httpJson(`${options.baseApi}/api/v1/admin/feedback/${feedbackId}`, {
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
