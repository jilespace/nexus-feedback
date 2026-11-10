/** 写操作链路：公开看板邮件订阅（weekly_digest）与清理。 */
import { DEMO_PROJECT_ID, DEMO_PROJECT_SLUG } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

export async function checkPublicSubscription(options, context) {
  const name = '写操作 · 公开看板订阅';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过公开订阅检查');
    return;
  }

  const authHeaders = { Authorization: `Bearer ${context.auth.token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };
  const projectId = context.projectId ?? DEMO_PROJECT_ID;
  const email = `smoke-sub-${Date.now()}@nexus.test`;
  const subscribeUrl = `${options.baseApi}/api/v1/public/${DEMO_PROJECT_SLUG}/subscribe`;
  const unsubscribeUrl = `${options.baseApi}/api/v1/public/unsubscribe`;
  const prefUrl = (suffix = '') =>
    `${options.baseApi}/api/v1/org/projects/${projectId}/notifications${suffix}`;
  const encodedEmail = encodeURIComponent(email);

  const subscribe = () =>
    httpJson(subscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type: 'weekly_digest' }),
    });
  const unsubscribe = () =>
    httpJson(unsubscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, project_id: projectId, type: 'all' }),
    });
  const deletePreference = () =>
    httpJson(prefUrl(`/${encodedEmail}`), { method: 'DELETE', headers: authHeaders });
  const listMatchingRows = async () => {
    const list = await httpJson(prefUrl('?page_size=100'), { headers: authHeaders });
    assert(list.status === 200 && list.json?.code === 0, `通知偏好列表 HTTP ${list.status}`);
    return (list.json?.data?.items ?? []).filter((item) => item.email === email);
  };

  await runCheck(name, async () => {
    let subscribed = false;
    try {
      const first = await subscribe();
      assert(first.status === 200 && first.json?.code === 0, `订阅失败 HTTP ${first.status}`);
      assert(first.json?.data?.subscribed === true, '订阅响应缺少 subscribed:true');
      assert(first.json?.data?.type === 'weekly_digest', '订阅响应 type 不匹配');
      subscribed = true;

      const duplicate = await subscribe();
      assert(
        duplicate.status === 200 && duplicate.json?.data?.subscribed === true,
        '重复订阅应保持幂等（200/subscribed:true）',
      );

      const pref = await httpJson(prefUrl(`/${encodedEmail}`), { headers: authHeaders });
      assert(pref.status === 200 && pref.json?.code === 0, `读取通知偏好 HTTP ${pref.status}`);
      assert(pref.json?.data?.email === email, '通知偏好 email 不匹配');
      assert(pref.json?.data?.weekly_digest === true, 'weekly_digest 偏好未写入');

      const rowsAfterSubscribe = await listMatchingRows();
      assert(rowsAfterSubscribe.length === 1, `幂等订阅后偏好行数应为 1，实际 ${rowsAfterSubscribe.length}`);

      const unsub = await unsubscribe();
      assert(unsub.status === 200 && unsub.json?.data?.unsubscribed === true, '退订失败');
      subscribed = false;

      const prefAfterUnsub = await httpJson(prefUrl(`/${encodedEmail}`), { headers: authHeaders });
      assert(
        prefAfterUnsub.json?.data?.weekly_digest === false,
        '退订后 weekly_digest 应为 false',
      );

      const deleted = await deletePreference();
      assert(deleted.status === 200 && deleted.json?.code === 0, `删除通知偏好 HTTP ${deleted.status}`);
      const residual = await listMatchingRows();
      assert(residual.length === 0, `清理后仍有 ${residual.length} 条订阅偏好残留`);
      return `email=${email} · 订阅/幂等/偏好写入/退订/删除 ✓ · 残留 0`;
    } finally {
      if (subscribed) await unsubscribe().catch(() => {});
      await deletePreference().catch(() => {});
    }
  });
}
