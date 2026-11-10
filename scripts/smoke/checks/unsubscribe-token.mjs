/** 公开端：退订 token 校验接口（无效/缺失均返回 400 信封）。 */
import { DEMO_PROJECT_SLUG } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck } from '../report.mjs';

function assertErrorEnvelope(label, response) {
  assert(response.status === 400, `${label} 期望 HTTP 400，实际 ${response.status}`);
  assert(response.json && typeof response.json === 'object', `${label} 响应不是 JSON 对象`);
  assert(
    typeof response.json.code === 'number' && response.json.code !== 0,
    `${label} code 应为非 0 数字（实际 ${response.json.code}）`,
  );
  assert(response.json.data === null, `${label} data 应为 null`);
  assert(
    typeof response.json.message === 'string' && response.json.message.length > 0,
    `${label} 缺少 message 文案`,
  );
}

export async function checkUnsubscribeTokenApi(options) {
  const name = '公开端 · 退订 token 校验';
  const url = `${options.baseApi}/api/v1/public/${DEMO_PROJECT_SLUG}/unsubscribe-token`;

  await runCheck(name, async () => {
    const invalid = await httpJson(`${url}?token=invalid`);
    assertErrorEnvelope('无效 token', invalid);

    const missing = await httpJson(url);
    assertErrorEnvelope('缺少 token', missing);

    return `无效 token 400(code=${invalid.json.code}) · 缺少 token 400(code=${missing.json.code}) · 信封校验 ✓`;
  });
}
