/** 写操作链路：更新日志关联 / 取消关联反馈。 */
import { DEMO_PROJECT_ID } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

export async function checkChangelogLink(options, context) {
  const name = '写操作 · 更新日志关联反馈';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过更新日志关联检查');
    return;
  }

  const authHeaders = { Authorization: `Bearer ${context.auth.token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };
  const projectId = context.projectId ?? DEMO_PROJECT_ID;
  const listUrl = `${options.baseApi}/api/v1/org/changelog?project_id=${encodeURIComponent(projectId)}&page_size=20`;
  let changelogId = null;
  let feedbackId = null;
  let linked = false;

  await runCheck(name, async () => {
    try {
      const list = await httpJson(listUrl, { headers: authHeaders });
      assert(list.status === 200 && list.json?.code === 0, `更新日志列表 HTTP ${list.status}`);
      const items = list.json?.data?.items ?? [];
      assert(Array.isArray(items) && items.length > 0, '后台没有可用的更新日志');
      assert(
        items.every((item) => Array.isArray(item.feedbacks)),
        '更新日志列表缺少 feedbacks 数组契约',
      );

      const changelog = items.find((item) => item.published) ?? items[0];
      changelogId = changelog.id;
      const existingIds = new Set((changelog.feedbacks ?? []).map((item) => item.id));

      const feedbackList = await httpJson(`${options.baseApi}/api/v1/admin/feedback?page_size=50`, {
        headers: authHeaders,
      });
      const feedback = (feedbackList.json?.data?.items ?? []).find(
        (item) => !existingIds.has(item.id),
      );
      assert(feedback?.id, '未找到可关联的反馈');
      feedbackId = feedback.id;

      const link = await httpJson(
        `${options.baseApi}/api/v1/org/changelog/${changelogId}/feedback`,
        {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ feedback_id: feedbackId }),
        },
      );
      assert(link.status === 201 && link.json?.code === 0, `关联失败 HTTP ${link.status}`);
      assert(link.json?.data?.feedback_id === feedbackId, '关联响应 feedback_id 不匹配');
      linked = true;

      const afterLink = await httpJson(listUrl, { headers: authHeaders });
      const linkedRow = (afterLink.json?.data?.items ?? []).find((item) => item.id === changelogId);
      assert(
        (linkedRow?.feedbacks ?? []).some((item) => item.id === feedbackId),
        '关联后更新日志列表未包含该反馈',
      );

      const unlink = await httpJson(
        `${options.baseApi}/api/v1/org/changelog/${changelogId}/feedback/${feedbackId}`,
        { method: 'DELETE', headers: authHeaders },
      );
      assert(unlink.status === 200 && unlink.json?.code === 0, `取消关联失败 HTTP ${unlink.status}`);
      linked = false;

      const afterUnlink = await httpJson(listUrl, { headers: authHeaders });
      const unlinkedRow = (afterUnlink.json?.data?.items ?? []).find(
        (item) => item.id === changelogId,
      );
      assert(
        !(unlinkedRow?.feedbacks ?? []).some((item) => item.id === feedbackId),
        '取消关联后更新日志列表仍包含该反馈',
      );
      return `changelog=${changelogId} · feedbacks 契约 ✓ · 关联/取消关联 ✓`;
    } finally {
      if (linked && changelogId && feedbackId) {
        try {
          await httpJson(
            `${options.baseApi}/api/v1/org/changelog/${changelogId}/feedback/${feedbackId}`,
            { method: 'DELETE', headers: authHeaders },
          );
        } catch {
          /* 尽力而为 */
        }
      }
    }
  });
}
