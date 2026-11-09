/** 检查结果收集与汇总表格输出。 */
import path from 'node:path';
import { ROOT, SHOT_DIR } from './config.mjs';
import { displayWidth, padCell, truncate } from './util.mjs';

const results = [];
export const startedAt = Date.now();

export async function runCheck(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, status: 'PASS', ms: Date.now() - start, detail: detail ? String(detail) : '' });
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      ms: Date.now() - start,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

export function skipCheck(name, reason) {
  results.push({ name, status: 'SKIP', ms: 0, detail: reason });
}

export function pushFailure(name, error) {
  results.push({
    name,
    status: 'FAIL',
    ms: 0,
    detail: error instanceof Error ? error.message : String(error),
  });
}

export function failedCount() {
  return results.filter((item) => item.status === 'FAIL').length;
}

export function printReport(totalMs) {
  const rows = results.map((result, index) => ({
    index: String(index + 1),
    status: result.status,
    name: result.name,
    ms: `${result.ms}ms`,
    detail: result.detail,
  }));
  const nameWidth = Math.max(
    displayWidth('检查项'),
    ...rows.map((row) => displayWidth(truncate(row.name, 34))),
    34,
  );
  const detailWidth = Math.max(40, ...rows.map((row) => displayWidth(truncate(row.detail, 90))));

  console.log('');
  console.log(
    `${padCell('#', 3)}  ${padCell('结果', 5)}  ${padCell('检查项', nameWidth)}  ${padCell('耗时', 7)}  说明`,
  );
  console.log(
    `${'-'.repeat(3)}  ${'-'.repeat(5)}  ${'-'.repeat(nameWidth)}  ${'-'.repeat(7)}  ${'-'.repeat(Math.min(detailWidth, 90))}`,
  );
  for (const row of rows) {
    console.log(
      `${padCell(row.index, 3)}  ${padCell(row.status, 5)}  ${padCell(row.name, nameWidth)}  ${padCell(row.ms, 7)}  ${truncate(row.detail, 90)}`,
    );
  }

  const failed = results.filter((result) => result.status === 'FAIL');
  const skipped = results.filter((result) => result.status === 'SKIP');
  if (failed.length > 0) {
    console.log('\n失败详情：');
    for (const result of failed) console.log(`  ❌ ${result.name}\n     ${result.detail}`);
  }
  if (skipped.length > 0) {
    console.log('\n跳过项：');
    for (const result of skipped) console.log(`  ⏭️  ${result.name} — ${result.detail}`);
  }

  const passCount = results.filter((result) => result.status === 'PASS').length;
  console.log(
    `\n合计 ${results.length} 项：PASS ${passCount} / FAIL ${failed.length} / SKIP ${skipped.length}，用时 ${(totalMs / 1000).toFixed(1)}s`,
  );
  console.log(`截图目录：${path.relative(ROOT, SHOT_DIR)}`);
}
