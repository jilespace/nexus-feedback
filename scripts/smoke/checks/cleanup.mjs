/** 写操作测试数据的兜底清理工具。 */
import { httpJson } from '../util.mjs';

/** 按标题尽力检索并软删除测试反馈，用于失败时的兜底清理。 */
export async function deleteFeedbackByTitle(options, token, title) {
  const headers = { Authorization: `Bearer ${token}` };
  let deleted = 0;
  try {
    const search = await httpJson(
      `${options.baseApi}/api/v1/admin/feedback?keyword=${encodeURIComponent(title)}&page_size=20`,
      { headers },
    );
    for (const item of search.json?.data?.items ?? []) {
      if (item.title !== title) continue;
      try {
        const response = await httpJson(`${options.baseApi}/api/v1/admin/feedback/${item.id}`, {
          method: 'DELETE',
          headers,
        });
        if (response.status === 200 && response.json?.code === 0) deleted += 1;
      } catch {
        /* 尽力而为 */
      }
    }
  } catch {
    /* 尽力而为 */
  }
  return deleted;
}

/** 清理冒烟产生的通知（标题含 [SMOKE]），避免重复运行时堆积。 */
export async function deleteSmokeNotifications(options, token) {
  const headers = { Authorization: `Bearer ${token}` };
  let deleted = 0;
  try {
    const list = await httpJson(`${options.baseApi}/api/v1/org/notifications?page_size=100`, {
      headers,
    });
    for (const item of list.json?.data?.items ?? []) {
      if (!String(item.title).includes('[SMOKE]') && !String(item.body ?? '').includes('[SMOKE]')) {
        continue;
      }
      try {
        const response = await httpJson(`${options.baseApi}/api/v1/org/notifications/${item.id}`, {
          method: 'DELETE',
          headers,
        });
        if (response.status === 200 && response.json?.code === 0) deleted += 1;
      } catch {
        /* 尽力而为 */
      }
    }
  } catch {
    /* 尽力而为 */
  }
  return deleted;
}
