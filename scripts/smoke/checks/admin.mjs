/** 后台：登录态注入 + 页面遍历 + 命令面板 / 通知铃铛。 */
import { ADMIN_READY, DEMO_PROJECT_ID, DEMO_PROJECT_SLUG, INFO_EXPR, LOGIN } from '../config.mjs';
import { assert, httpJson } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';
import { diagnosticsSummary } from '../chrome.mjs';

async function loginAdmin(options) {
  const response = await httpJson(`${options.baseApi}/api/v1/org/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });
  assert(response.status === 200, `登录接口 HTTP ${response.status}`);
  assert(response.json?.code === 0, `登录失败：${response.json?.message ?? '响应 code 非 0'}`);
  const data = response.json?.data ?? {};
  assert(typeof data.token === 'string' && data.token.length > 20, '登录响应缺少 token');
  assert(data.member?.id, '登录响应缺少 member');
  assert(data.organization?.id, '登录响应缺少 organization');
  return data;
}

async function resolveProjectId(options, token) {
  try {
    const response = await httpJson(`${options.baseApi}/api/v1/org/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const projects = Array.isArray(response.json?.data) ? response.json.data : [];
    const demo = projects.find((project) => project.slug === DEMO_PROJECT_SLUG) ?? projects[0];
    if (demo?.id) return demo.id;
  } catch {
    /* 回退到固定 id */
  }
  return DEMO_PROJECT_ID;
}

function adminPageNames() {
  return [
    '后台 · 仪表盘',
    '后台 · 反馈列表',
    '后台 · 更新日志',
    '后台 · 项目接入',
    '后台 · 团队成员',
    '后台 · 标签管理',
    '后台 · 审计日志',
    '后台 · 组织设置',
    '后台 · 系统配置',
    '后台 · 项目设置',
    '后台 · Widget 配置',
    '后台 · 状态配置',
    '后台 · 分类配置',
    '后台 · Webhooks',
    '后台 · 通知偏好',
  ];
}

export async function checkAdmin(page, options, context) {
  let session = null;
  await runCheck('后台 · 登录接口发放 token', async () => {
    session = await loginAdmin(options);
    context.auth = session;
    return `member=${session.member.display_name ?? session.member.email} role=${session.member.role}`;
  });

  if (!session) {
    for (const name of adminPageNames()) {
      skipCheck(name, '登录失败，跳过依赖登录态的检查');
    }
    skipCheck('后台 · 命令面板 ⌘K', '登录失败，跳过');
    skipCheck('后台 · 通知铃铛', '登录失败，跳过');
    skipCheck('后台 · 命令面板输入「通知」回车跳转', '登录失败，跳过');
    return;
  }

  const projectId = await resolveProjectId(options, session.token);
  context.projectId = projectId;

  // 在文档加载前注入登录态，避免先落到登录页。
  const initScript = `(() => {
    try {
      if (location.origin !== ${JSON.stringify(new URL(options.baseAdmin).origin)}) return;
      localStorage.setItem('admin_token', ${JSON.stringify(session.token)});
      localStorage.setItem('org_member', ${JSON.stringify(JSON.stringify(session.member))});
      localStorage.setItem('org_info', ${JSON.stringify(JSON.stringify(session.organization))});
      localStorage.setItem('theme', 'light');
      localStorage.setItem('lang', 'zh');
    } catch (error) { /* ignore */ }
  })();`;
  await page.addInitScript(initScript);

  const pages = [
    ['后台 · 仪表盘', '/dashboard'],
    ['后台 · 反馈列表', '/feedback'],
    ['后台 · 更新日志', '/changelog'],
    ['后台 · 项目接入', '/applications'],
    ['后台 · 团队成员', '/members'],
    ['后台 · 标签管理', '/tags'],
    ['后台 · 审计日志', '/audit-logs'],
    ['后台 · 组织设置', '/settings'],
    ['后台 · 系统配置', '/system-config'],
  ];
  const subpages = [
    ['后台 · 项目设置', 'settings'],
    ['后台 · Widget 配置', 'widget'],
    ['后台 · 状态配置', 'statuses'],
    ['后台 · 分类配置', 'categories'],
    ['后台 · Webhooks', 'webhooks'],
    ['后台 · 通知偏好', 'notifications'],
  ].map(([name, segment]) => [name, `/projects/${projectId}/${segment}`]);

  for (const [name, pagePath] of [...pages, ...subpages]) {
    await runCheck(name, async () => {
      const url = `${options.baseAdmin}${pagePath}`;
      await page.navigate(url, { readyExpression: ADMIN_READY, timeoutMs: 20000 });
      const info = await page.evaluate(INFO_EXPR);
      assert(info.pathname === pagePath, `期望路径 ${pagePath}，实际 ${info.pathname}`);
      assert(info.mainText > 20, `main 内容过少（${info.mainText} 字）`);
      assert(!String(info.href).includes('/login'), '被重定向到登录页（登录态注入失败）');
      page.assertClean(name);
      const fileName = `admin${pagePath.replace(/[/:]/g, '-')}`;
      const shot = await page.screenshot(fileName);
      const extra = diagnosticsSummary(page);
      return `${info.mainText} 字${extra ? ` · ${extra}` : ''}${shot ? ` · ${shot}` : ''}`;
    });
  }

  await runCheck('后台 · 命令面板 ⌘K 可打开', async () => {
    await page.navigate(`${options.baseAdmin}/dashboard`, { readyExpression: ADMIN_READY, timeoutMs: 20000 });
    await page.evaluate(`(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, ctrlKey: false, bubbles: true, cancelable: true }));
      return true;
    })()`);
    const opened = await page.waitUntil(`!!document.querySelector('[role="dialog"][aria-label="命令面板"]')`, {
      timeoutMs: 5000,
    });
    assert(opened, '⌘K 未打开命令面板');
    const palette = await page.evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="命令面板"]');
      return {
        dialog: !!dialog,
        input: !!dialog?.querySelector('input'),
        text: (dialog?.innerText ?? '').trim().length,
      };
    })()`);
    assert(palette.input, '命令面板缺少搜索输入框');
    assert(palette.text > 10, '命令面板内容为空');
    const shot = await page.screenshot('admin-command-palette');
    await page.evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`,
    );
    const closed = await page.waitUntil(`!document.querySelector('[role="dialog"][aria-label="命令面板"]')`, {
      timeoutMs: 4000,
    });
    assert(closed, 'Esc 未关闭命令面板');
    page.assertClean('命令面板');
    return `⌘K 打开 + Esc 关闭${shot ? ` · ${shot}` : ''}`;
  });

  await runCheck('后台 · 通知铃铛存在', async () => {
    await page.navigate(`${options.baseAdmin}/dashboard`, { readyExpression: ADMIN_READY, timeoutMs: 20000 });
    const bell = await page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-label="通知"]'));
      const visible = buttons.find((button) => button.getClientRects().length > 0);
      if (!visible) return { found: false };
      visible.click();
      return { found: true, expanded: visible.getAttribute('aria-expanded') };
    })()`);
    assert(bell.found, '未找到可见的通知铃铛');
    const opened = await page.waitUntil(`!!document.querySelector('[role="dialog"][aria-label="通知"]')`, {
      timeoutMs: 5000,
    });
    assert(opened, '点击铃铛后未打开通知面板');
    const panelText = await page.evaluate(
      `(document.querySelector('[role="dialog"][aria-label="通知"]')?.innerText ?? '').trim().length`,
    );
    assert(panelText > 0, '通知面板内容为空');
    const shot = await page.screenshot('admin-notification-bell');
    await page.evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`,
    );
    const closed = await page.waitUntil(`!document.querySelector('[role="dialog"][aria-label="通知"]')`, {
      timeoutMs: 4000,
    });
    assert(closed, 'Esc 未关闭通知面板');
    page.assertClean('通知铃铛');
    return `面板内容 ${panelText} 字${shot ? ` · ${shot}` : ''}`;
  });

  await runCheck('后台 · 命令面板输入「通知」回车跳转', async () => {
    await page.navigate(`${options.baseAdmin}/dashboard`, { readyExpression: ADMIN_READY, timeoutMs: 20000 });
    await page.evaluate(`(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, ctrlKey: false, bubbles: true, cancelable: true }));
      return true;
    })()`);
    const opened = await page.waitUntil(`!!document.querySelector('[role="dialog"][aria-label="命令面板"]')`, {
      timeoutMs: 5000,
    });
    assert(opened, '⌘K 未打开命令面板');

    // 用原生 setter + input 事件驱动受控输入，再按回车执行当前高亮项。
    await page.evaluate(`(() => {
      const input = document.querySelector('[role="dialog"][aria-label="命令面板"] input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '通知');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return true;
    })()`);
    // 等过滤完成：首项必须变成「查看通知」，避免在未过滤列表上回车命中「新建更新日志」。
    const suggestionReady = await page.waitUntil(
      `(() => {
        const first = document.querySelector('#cmd-item-0');
        return !!first && first.innerText.includes('查看通知');
      })()`,
      { timeoutMs: 5000 },
    );
    assert(suggestionReady, '输入「通知」后首项未切换为「查看通知」动作');
    await page.evaluate(`(() => {
      const input = document.querySelector('[role="dialog"][aria-label="命令面板"] input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      return true;
    })()`);
    const navigated = await page.waitUntil(`location.pathname === '/notifications'`, { timeoutMs: 8000 });
    if (!navigated) {
      const currentPath = await page.evaluate('location.pathname');
      throw new Error(`回车后 URL 未跳转到 /notifications（当前 ${currentPath}）`);
    }
    const contentReady = await page.waitUntil(
      `(document.querySelector('main')?.innerText.trim().length ?? 0) > 10`,
      { timeoutMs: 8000 },
    );
    assert(contentReady, '/notifications 页面未渲染内容');
    const paletteClosed = await page.waitUntil(
      `!document.querySelector('[role="dialog"][aria-label="命令面板"]')`,
      { timeoutMs: 4000 },
    );
    assert(paletteClosed, '跳转后命令面板未关闭');
    page.assertClean('命令面板动作');
    const shot = await page.screenshot('admin-command-palette-action');
    return `URL=/notifications${shot ? ` · ${shot}` : ''}`;
  });
}
