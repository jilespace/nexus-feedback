/** 写操作链路：成员已保存视图（saved views）同步与校验。 */
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

const sameViews = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export async function checkSavedViews(options, context) {
  const name = '写操作 · 已保存视图同步';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过已保存视图检查');
    return;
  }

  const authHeaders = { Authorization: `Bearer ${context.auth.token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };
  const url = `${options.baseApi}/api/v1/org/member/saved-views`;
  const putViews = (views) =>
    httpJson(url, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ views }),
    });

  await runCheck(name, async () => {
    let original = null;
    let restored = false;
    try {
      const before = await httpJson(url, { headers: authHeaders });
      assert(before.status === 200 && before.json?.code === 0, `读取已保存视图 HTTP ${before.status}`);
      assert(Array.isArray(before.json?.data), '已保存视图 data 不是数组');
      original = before.json.data;

      const stamp = Date.now();
      const view = {
        name: `smoke view ${stamp}`,
        filters: { status: 'open' },
        created_at: new Date().toISOString(),
      };
      const put = await putViews([view]);
      assert(put.status === 200 && put.json?.code === 0, `保存视图 HTTP ${put.status}`);
      assert(Array.isArray(put.json?.data) && put.json.data.length === 1, '保存视图返回数量不为 1');
      const saved = put.json.data[0];
      assert(saved.name === view.name, '保存视图名称不一致');
      assert(saved.filters?.status === 'open', '保存视图 filters 不一致');
      assert(saved.created_at === view.created_at, '保存视图 created_at 不一致');

      const readBack = await httpJson(url, { headers: authHeaders });
      assert(
        Array.isArray(readBack.json?.data) && sameViews(readBack.json.data, put.json.data),
        '读回的已保存视图与保存结果不一致',
      );

      const tooMany = Array.from({ length: 11 }, (_, index) => ({
        name: `smoke view ${index}-${stamp}`,
        filters: { status: 'open' },
        created_at: new Date().toISOString(),
      }));
      const overLimit = await putViews(tooMany);
      assert(
        overLimit.status === 400 && typeof overLimit.json?.code === 'number' && overLimit.json.code !== 0,
        `11 条视图未返回 400/code≠0（HTTP ${overLimit.status}）`,
      );

      const badFilters = await putViews([
        {
          name: `smoke bad filters ${stamp}`,
          filters: { status: 1 },
          created_at: new Date().toISOString(),
        },
      ]);
      assert(
        badFilters.status === 400 && typeof badFilters.json?.code === 'number' && badFilters.json.code !== 0,
        `filters 非字符串未返回 400/code≠0（HTTP ${badFilters.status}）`,
      );

      const afterInvalid = await httpJson(url, { headers: authHeaders });
      assert(
        sameViews(afterInvalid.json?.data, put.json.data),
        '非法负载不应改动已保存视图',
      );

      const restore = await putViews(original);
      assert(restore.status === 200 && restore.json?.code === 0, `恢复已保存视图 HTTP ${restore.status}`);
      restored = true;
      const finalState = await httpJson(url, { headers: authHeaders });
      assert(sameViews(finalState.json?.data, original), '恢复后的已保存视图与原值不一致');
      return `保存/读回一致 ✓ · 11 条与非法 filters 均 400 · 已恢复原值（${original.length} 条）`;
    } finally {
      if (!restored && original !== null) {
        try {
          await putViews(original);
        } catch {
          /* 尽力而为 */
        }
      }
    }
  });
}
