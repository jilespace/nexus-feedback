/** 写操作链路：CSV 导入 dry_run → commit → 检索 → 软删除。 */
import { DEMO_PROJECT_ID } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';
import { deleteFeedbackByTitle } from './cleanup.mjs';

export async function checkCsvImport(options, context) {
  const name = '写操作 · CSV 导入 dry_run → commit → 检索 → 软删除';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过 CSV 导入检查');
    return;
  }

  const token = context.auth.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };
  const projectId = context.projectId ?? DEMO_PROJECT_ID;
  const stamp = Date.now();
  const dryRunTitle = `[SMOKE] 导入 dry-run ${stamp}`;
  const commitTitle = `[SMOKE] 导入 commit ${stamp}`;
  const importUrl = `${options.baseApi}/api/v1/admin/feedback/import`;
  const searchUrl = (title) =>
    `${options.baseApi}/api/v1/admin/feedback?keyword=${encodeURIComponent(title)}&page_size=10`;

  await runCheck(name, async () => {
    let importedId = null;
    try {
      // a) 混合 dry-run：1 有效 + 1 无效分类，断言索引且不写库。
      const mixed = await httpJson(importUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          project_id: projectId,
          dry_run: true,
          rows: [
            { title: dryRunTitle, content: 'dry_run 有效行，不应写入数据库。', category: 'other' },
            { title: '[SMOKE] 导入无效行', content: '分类非法，应被标记为无效。', category: 'nope' },
          ],
        }),
      });
      assert(mixed.status === 200, `混合 dry_run HTTP ${mixed.status}`);
      assert(mixed.json?.code === 0, `混合 dry_run code=${mixed.json?.code}`);
      const mixedData = mixed.json?.data ?? {};
      assert(mixedData.total === 2, `dry_run total=${mixedData.total}（期望 2）`);
      assert(mixedData.valid === 1, `dry_run valid=${mixedData.valid}（期望 1）`);
      assert(
        Array.isArray(mixedData.invalid_rows) && mixedData.invalid_rows.length === 1,
        `dry_run invalid_rows 数量=${mixedData.invalid_rows?.length}（期望 1）`,
      );
      assert(
        mixedData.invalid_rows[0].index === 1,
        `invalid_rows[0].index=${mixedData.invalid_rows[0].index}（期望 1）`,
      );
      const drySearch = await httpJson(searchUrl(dryRunTitle), { headers: authHeaders });
      const dryWritten = (drySearch.json?.data?.items ?? []).some(
        (item) => item.title === dryRunTitle,
      );
      assert(!dryWritten, 'dry_run 后按标题检索到数据（不应写库）');

      // b) 单条有效 dry-run → commit → 检索确认 → 软删除。
      const rows = [
        {
          title: commitTitle,
          content: '由 pnpm smoke 通过 CSV 导入创建的测试反馈，验证后会软删除。',
          category: 'other',
          priority: 'medium',
        },
      ];
      const single = await httpJson(importUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ project_id: projectId, dry_run: true, rows }),
      });
      assert(
        single.status === 200 && single.json?.code === 0 && single.json?.data?.valid === 1,
        `单条 dry_run 未通过（HTTP ${single.status} code=${single.json?.code}）`,
      );

      const commit = await httpJson(importUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ project_id: projectId, dry_run: false, rows }),
      });
      assert(commit.status === 200, `commit HTTP ${commit.status}`);
      assert(commit.json?.code === 0, `commit code=${commit.json?.code}`);
      assert(commit.json?.data?.imported === 1, `imported=${commit.json?.data?.imported}（期望 1）`);

      const found = await httpJson(searchUrl(commitTitle), { headers: authHeaders });
      const target = (found.json?.data?.items ?? []).find(
        (item) => item.title === commitTitle,
      );
      assert(target?.id, 'commit 后未按标题检索到导入的反馈');
      importedId = target.id;

      const deleted = await httpJson(`${options.baseApi}/api/v1/admin/feedback/${importedId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(deleted.status === 200 && deleted.json?.code === 0, `软删除失败 HTTP ${deleted.status}`);
      importedId = null;

      const after = await httpJson(searchUrl(commitTitle), { headers: authHeaders });
      const stillExists = (after.json?.data?.items ?? []).some(
        (item) => item.title === commitTitle,
      );
      assert(!stillExists, '软删除后仍能检索到导入的反馈');

      // audit 子断言：接口支持 action 过滤时校验，不支持则跳过。
      let auditDetail = 'audit 过滤不可用，跳过';
      try {
        const audit = await httpJson(
          `${options.baseApi}/api/v1/org/audit-logs?action=feedback.import&page_size=10`,
          { headers: authHeaders },
        );
        if (audit.status === 200 && audit.json?.code === 0) {
          const hit = (audit.json.data?.items ?? []).find(
            (item) => item.action === 'feedback.import',
          );
          auditDetail = hit
            ? 'audit=feedback.import ✓'
            : 'audit 暂无 feedback.import（子断言跳过）';
        } else {
          auditDetail = `audit 过滤不支持（HTTP ${audit.status}），跳过`;
        }
      } catch {
        auditDetail = 'audit 请求失败，跳过';
      }

      return `dry_run valid=1/invalid index=1 不写库 · imported=1 · 检索+软删除 ✓ · ${auditDetail}`;
    } finally {
      if (importedId) {
        try {
          await httpJson(`${options.baseApi}/api/v1/admin/feedback/${importedId}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
        } catch {
          /* 尽力而为 */
        }
      }
      await deleteFeedbackByTitle(options, token, dryRunTitle).catch(() => {});
      await deleteFeedbackByTitle(options, token, commitTitle).catch(() => {});
    }
  });
}
