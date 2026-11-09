/** 公开端：仓库内 widget demo（Shadow DOM + 面板）。 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ROOT, WIDGET_DEMO_SERVER, WIDGET_DEMO_URL, WIDGET_DIST_IIFE } from '../config.mjs';
import { assert, truncate, waitForHttp } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

export async function checkWidget(page, _options, context) {
  const name = '公开端 · widget demo 嵌入';

  if (!existsSync(WIDGET_DEMO_SERVER)) {
    skipCheck(name, '未找到 packages/widget/demo/server.mjs（仓库内 demo 缺失）');
    return;
  }
  if (!existsSync(WIDGET_DIST_IIFE)) {
    skipCheck(
      name,
      'widget dist 不存在，先运行 pnpm --filter @nexus-feedback/widget build 后重试',
    );
    return;
  }

  await runCheck(name, async () => {
    const alreadyRunning = await waitForHttp(WIDGET_DEMO_URL, 1500);
    if (!alreadyRunning) {
      context.widgetProcess = spawn(process.execPath, [WIDGET_DEMO_SERVER], {
        cwd: ROOT,
        stdio: 'ignore',
        windowsHide: true,
      });
      const ready = await waitForHttp(WIDGET_DEMO_URL, 12000);
      assert(ready, 'widget demo 服务器未能在 12s 内启动（端口 8099，可先手动启动排查）');
    }

    await page.navigate(WIDGET_DEMO_URL, {
      readyExpression: `!!document.querySelector('#nexus-widget-root > div')?.shadowRoot?.querySelector('.nf-launcher')`,
      timeoutMs: 15000,
    });
    const launcher = await page.evaluate(`(() => {
      const host = document.querySelector('#nexus-widget-root > div');
      const root = host?.shadowRoot;
      const button = root?.querySelector('.nf-launcher');
      button?.click();
      return {
        hasShadow: !!root,
        launcher: !!button,
        label: button?.textContent?.trim() ?? '',
        tooltip: root?.querySelector('.nf-tooltip')?.textContent?.trim() ?? '',
      };
    })()`);
    assert(launcher.hasShadow, 'Widget 未挂载 Shadow DOM');
    assert(launcher.launcher, '未找到 launcher');
    assert(launcher.label.length > 0, 'launcher 无文案');
    const panelReady = await page.waitUntil(
      `!!document.querySelector('#nexus-widget-root > div')?.shadowRoot?.querySelector('.nf-panel')`,
      { timeoutMs: 5000 },
    );
    assert(panelReady, '点击 launcher 后未打开面板');
    const panel = await page.evaluate(`(() => {
      const root = document.querySelector('#nexus-widget-root > div')?.shadowRoot;
      const panel = root?.querySelector('.nf-panel');
      return {
        panel: !!panel,
        width: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
        form: !!root?.querySelector('.nf-form'),
        close: !!root?.querySelector('.nf-close'),
      };
    })()`);
    assert(panel.form, '面板内未渲染表单');
    assert(panel.close, '面板缺少关闭按钮');
    page.assertClean('widget demo');
    const shot = await page.screenshot('widget-demo');
    return `仓库内 demo · launcher「${launcher.label}」· 面板 ${panel.width}px · tooltip「${truncate(launcher.tooltip, 12)}」${shot ? ` · ${shot}` : ''}`;
  });
}
