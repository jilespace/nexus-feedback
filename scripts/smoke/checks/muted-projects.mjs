/** 写操作链路：按项目静音（mutedProjects）命中时静默丢弃通知。 */
import { setTimeout as sleep } from 'node:timers/promises';
import { DEMO_API_KEY, DEMO_PROJECT_ID } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';
import { deleteSmokeNotifications } from './cleanup.mjs';

const sameSet = (left, right) =>
  Array.isArray(left) &&
  Array.isArray(right) &&
  left.length === right.length &&
  [...left].sort().every((value, index) => value === [...right].sort()[index]);

export async function checkProjectMute(options, context) {
  const name = '写操作 · 通知按项目静音';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过项目静音检查');
    return;
  }

  const authHeaders = { Authorization: `Bearer ${context.auth.token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };
  const settingsUrl = `${options.baseApi}/api/v1/org/notifications/settings`;
  const unreadUrl = `${options.baseApi}/api/v1/org/notifications/unread-count`;
  const projectId = context.projectId ?? DEMO_PROJECT_ID;
  let originalSettings = null;
  let feedbackId = null;

  const readUnread = async () => {
    const response = await httpJson(unreadUrl, { headers: authHeaders });
    assert(response.status === 200 && response.json?.code === 0, `unread-count 失败 HTTP ${response.status}`);
    return Number(response.json?.data?.count ?? 0);
  };
  const putSettings = (settings) =>
    httpJson(settingsUrl, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ settings }),
    });

  await runCheck(name, async () => {
    try {
      const before = await httpJson(settingsUrl, { headers: authHeaders });
      assert(before.status === 200 && before.json?.code === 0, `读取通知设置 HTTP ${before.status}`);
      originalSettings = before.json?.data ?? null;
      assert(Array.isArray(originalSettings?.mutedProjects), '通知设置缺少 mutedProjects 数组');

      const mute = await putSettings({ mutedProjects: [projectId] });
      assert(mute.status === 200 && mute.json?.code === 0, `设置项目静音 HTTP ${mute.status}`);
      assert(
        (mute.json?.data?.mutedProjects ?? []).includes(projectId),
        '项目静音设置未生效',
      );

      const unreadBefore = await readUnread();
      const title = `[SMOKE] 项目静音 ${Date.now()}`;
      const created = await httpJson(`${options.baseApi}/api/v1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DEMO_API_KEY },
        body: JSON.stringify({
          title,
          content: 'pnpm smoke 自动创建的测试反馈，用于验证项目静音期间站内通知被静默丢弃。',
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
        `项目静音期间未读数应保持不变（${unreadBefore} → ${unreadAfter}）`,
      );
      const list = await httpJson(`${options.baseApi}/api/v1/org/notifications?page=1&page_size=20`, {
        headers: authHeaders,
      });
      const hit = (list.json?.data?.items ?? []).some((item) =>
        String(item.title ?? '').includes(title),
      );
      assert(!hit, '项目静音期间仍生成了该测试反馈的站内通知');

      const restore = await putSettings({ mutedProjects: originalSettings.mutedProjects });
      assert(restore.status === 200 && restore.json?.code === 0, `恢复项目静音失败 HTTP ${restore.status}`);
      assert(
        sameSet(restore.json?.data?.mutedProjects, originalSettings.mutedProjects),
        '恢复后的 mutedProjects 与原值不一致',
      );

      const invalid = await putSettings({ mutedProjects: 'not-an-array' });
      assert(
        invalid.status === 400 && typeof invalid.json?.code === 'number' && invalid.json.code !== 0,
        `非法 mutedProjects 未返回 400/code≠0（HTTP ${invalid.status}）`,
      );
      const afterInvalid = await httpJson(settingsUrl, { headers: authHeaders });
      assert(
        sameSet(afterInvalid.json?.data?.mutedProjects, originalSettings.mutedProjects),
        '非法负载不应改动 mutedProjects',
      );
      return `unread ${unreadBefore} 保持不变 · 非法负载 400(code=${invalid.json.code}) · 已恢复并软删`;
    } finally {
      if (originalSettings) {
        try {
          await putSettings({
            dnd: originalSettings.dnd,
            mutedProjects: originalSettings.mutedProjects,
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
