/** API 基础检查与响应信封契约。 */
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

export async function checkApi(options) {
  await runCheck('API · health 返回 200', async () => {
    const { status, json } = await httpJson(`${options.baseApi}/api/v1/health`);
    assert(status === 200, `HTTP ${status}`);
    assert(json?.code === 0, `响应 code=${json?.code ?? 'null'}`);
    return 'GET /api/v1/health → 200 code=0';
  });

  await runCheck('API · 未认证访问 admin 接口返回 401', async () => {
    const { status } = await httpJson(`${options.baseApi}/api/v1/admin/feedback`);
    assert(status === 401, `期望 401，实际 HTTP ${status}`);
    return 'GET /api/v1/admin/feedback → 401';
  });
}

/** 统一响应信封：{ code: number, data: any, message: string }。 */
function assertEnvelope(label, body) {
  assert(body && typeof body === 'object', `${label} 响应不是 JSON 对象`);
  assert(typeof body.code === 'number', `${label} 缺少数字 code（got ${typeof body.code}）`);
  assert(Object.prototype.hasOwnProperty.call(body, 'data'), `${label} 缺少 data 字段`);
  assert(typeof body.message === 'string', `${label} 缺少 message 字符串`);
}

export async function checkApiContract(options, context) {
  const names = [
    'API 契约 · 统一响应信封（health / notifications / feedback）',
    'API 契约 · 未认证 org/notifications 返回 401 且 code≠0',
  ];
  if (!context.auth) {
    for (const name of names) skipCheck(name, '未建立后台登录态，跳过契约检查');
    return;
  }
  const headers = { Authorization: `Bearer ${context.auth.token}` };

  await runCheck(names[0], async () => {
    const health = await httpJson(`${options.baseApi}/api/v1/health`);
    assert(health.status === 200, `health HTTP ${health.status}`);
    assertEnvelope('health', health.json);
    assert(health.json.code === 0, `health code=${health.json.code}`);

    const notifications = await httpJson(
      `${options.baseApi}/api/v1/org/notifications?page=1&page_size=1`,
      { headers },
    );
    assert(notifications.status === 200, `org/notifications HTTP ${notifications.status}`);
    assertEnvelope('org/notifications', notifications.json);
    assert(notifications.json.code === 0, `org/notifications code=${notifications.json.code}`);
    assert(
      Array.isArray(notifications.json.data?.items),
      'org/notifications data.items 不是数组',
    );

    const feedback = await httpJson(`${options.baseApi}/api/v1/admin/feedback?page_size=1`, {
      headers,
    });
    assert(feedback.status === 200, `admin/feedback HTTP ${feedback.status}`);
    assertEnvelope('admin/feedback', feedback.json);
    assert(feedback.json.code === 0, `admin/feedback code=${feedback.json.code}`);
    assert(Array.isArray(feedback.json.data?.items), 'admin/feedback data.items 不是数组');
    assert(feedback.json.data.items.length <= 1, 'admin/feedback page_size=1 返回超过 1 条');
    return 'health / notifications / admin feedback 信封均为 {code:number,data,message} 且 code=0';
  });

  await runCheck(names[1], async () => {
    const response = await httpJson(`${options.baseApi}/api/v1/org/notifications`);
    assert(response.status === 401, `期望 HTTP 401，实际 ${response.status}`);
    assertEnvelope('未认证 org/notifications', response.json);
    assert(response.json.code !== 0, '未认证响应 code 不应为 0');
    return `HTTP 401 · code=${response.json.code} · data=null`;
  });
}
