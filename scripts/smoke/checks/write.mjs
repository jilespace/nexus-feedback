/** 写操作链路：公开提交页真实提交 + 通知未读/全部已读（自动清理）。 */
import { setTimeout as sleep } from 'node:timers/promises';
import { DEMO_API_KEY } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';
import { deleteFeedbackByTitle, deleteSmokeNotifications } from './cleanup.mjs';

export async function checkWriteFlows(page, options, context) {
  const checkNames = [
    '写操作 · 公开提交页提交 → 后台检索 → 软删除',
    '写操作 · 通知触发 → unread → read-all → 0',
  ];
  if (!context.auth) {
    for (const name of checkNames) skipCheck(name, '未建立后台登录态，跳过写操作检查');
    return;
  }

  const token = context.auth.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  await runCheck(checkNames[0], async () => {
    const title = `[SMOKE] 提交链路 ${Date.now()}`;
    const content = `由 pnpm smoke 于 ${new Date().toISOString()} 自动提交，用于验证公开提交页写入与后台检索链路，测试结束后会自动软删除。`;
    let feedbackId = null;
    let cleaned = false;
    try {
      await page.navigate(`${options.baseSubmit}/?key=${DEMO_API_KEY}`, {
        readyExpression: `!!document.querySelector('#feedback-title')`,
      });
      await page.evaluate(`(() => {
        const setValue = (element, value) => {
          const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setValue(document.querySelector('#feedback-title'), ${JSON.stringify(title)});
        setValue(document.querySelector('#feedback-content'), ${JSON.stringify(content)});
        return true;
      })()`);
      await sleep(250);
      await page.evaluate(`document.querySelector('button[type="submit"]')?.click() ?? true`);
      const submitted = await page.waitUntil(`document.body.innerText.includes('反馈已收到')`, {
        timeoutMs: 15000,
      });
      assert(submitted, '提交后未进入成功态');

      const searchUrl = `${options.baseApi}/api/v1/admin/feedback?keyword=${encodeURIComponent(title)}&page_size=20`;
      const search = await httpJson(searchUrl, { headers: authHeaders });
      assert(search.status === 200 && search.json?.code === 0, `后台检索失败 HTTP ${search.status}`);
      const found = (search.json?.data?.items ?? []).find((item) => item.title === title);
      assert(found?.id, '后台未检索到刚提交的反馈');
      feedbackId = found.id;

      const deleted = await httpJson(`${options.baseApi}/api/v1/admin/feedback/${feedbackId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(deleted.status === 200 && deleted.json?.code === 0, `软删除失败 HTTP ${deleted.status}`);
      cleaned = true;

      const after = await httpJson(searchUrl, { headers: authHeaders });
      const stillExists = (after.json?.data?.items ?? []).some((item) => item.title === title);
      assert(!stillExists, '软删除后仍能检索到该测试反馈');
      const shot = await page.screenshot('write-submit-success', { full: true });
      return `id=${feedbackId} · 检索确认 ✓ · 软删除 ✓${shot ? ` · ${shot}` : ''}`;
    } finally {
      if (!cleaned) await deleteFeedbackByTitle(options, token, title).catch(() => {});
      await deleteSmokeNotifications(options, token).catch(() => {});
    }
  });

  await runCheck(checkNames[1], async () => {
    const title = `[SMOKE] 通知链路 ${Date.now()}`;
    let feedbackId = null;
    let readAllDone = false;

    const unreadCount = async () => {
      const response = await httpJson(`${options.baseApi}/api/v1/org/notifications/unread-count`, {
        headers: authHeaders,
      });
      assert(response.status === 200 && response.json?.code === 0, `unread-count 失败 HTTP ${response.status}`);
      return Number(response.json?.data?.count ?? 0);
    };

    try {
      // 先清空基线未读，确保断言的是本轮创建触发的新通知。
      const baseline = await httpJson(`${options.baseApi}/api/v1/org/notifications/read-all`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert(baseline.status === 200 && baseline.json?.code === 0, '通知基线 read-all 失败');

      const created = await httpJson(`${options.baseApi}/api/v1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DEMO_API_KEY },
        body: JSON.stringify({
          title,
          content: 'pnpm smoke 自动创建的测试反馈，用于验证创建通知 → 未读数 → 全部已读链路。',
          category: 'other',
          priority: 'medium',
          source: 'api',
        }),
      });
      assert(created.status === 201 && created.json?.code === 0, `创建公开反馈失败 HTTP ${created.status}`);
      feedbackId = created.json?.data?.id ?? null;
      assert(feedbackId, '创建公开反馈未返回 id');

      let unread = 0;
      const unreadDeadline = Date.now() + 8000;
      while (Date.now() < unreadDeadline) {
        unread = await unreadCount();
        if (unread > 0) break;
        await sleep(250);
      }
      assert(unread > 0, `创建反馈后 unread-count 未增加（${unread}）`);

      const readAll = await httpJson(`${options.baseApi}/api/v1/org/notifications/read-all`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert(readAll.status === 200 && readAll.json?.code === 0, `read-all 失败 HTTP ${readAll.status}`);
      readAllDone = true;

      let after = -1;
      const readDeadline = Date.now() + 4000;
      while (Date.now() < readDeadline) {
        after = await unreadCount();
        if (after === 0) break;
        await sleep(200);
      }
      assert(after === 0, `read-all 后 unread-count=${after}`);
      return `unread ${unread} → read-all → 0 · feedback=${feedbackId}`;
    } finally {
      if (!readAllDone) {
        try {
          await httpJson(`${options.baseApi}/api/v1/org/notifications/read-all`, {
            method: 'POST',
            headers: authHeaders,
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
      } else {
        await deleteFeedbackByTitle(options, token, title).catch(() => {});
      }
      await deleteSmokeNotifications(options, token).catch(() => {});
    }
  });
}
