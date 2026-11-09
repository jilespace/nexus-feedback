/** 移动端 390×844：页面布局 + 抽屉 / 通知面板 / 命令面板交互。 */
import { setTimeout as sleep } from 'node:timers/promises';
import { ADMIN_READY } from '../config.mjs';
import { assert } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

export async function checkMobile(page, options, context) {
  const targets = [
    ['移动端 390 · 仪表盘', '/dashboard', 'mobile-dashboard'],
    ['移动端 390 · 反馈列表', '/feedback', 'mobile-feedback'],
    ['移动端 390 · 通知中心', '/notifications', 'mobile-notifications'],
  ];
  if (!context.auth) {
    for (const [name] of targets) skipCheck(name, '未建立后台登录态，跳过移动端检查');
    for (const name of [
      '移动端 390 · 汉堡抽屉开 / 遮罩关',
      '移动端 390 · 通知铃铛开 / Esc 关',
      '移动端 390 · ⌘K 输入「通知」回车跳转',
    ]) {
      skipCheck(name, '未建立后台登录态，跳过移动端交互检查');
    }
    return;
  }

  const metricsExpr = `(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    pathname: location.pathname,
    mainText: (document.querySelector('main')?.innerText ?? '').trim().length,
  }))()`;

  try {
    await page.setViewport({ width: 390, height: 844, mobile: true, deviceScaleFactor: 2 });
    for (const [name, pagePath, fileName] of targets) {
      await runCheck(name, async () => {
        await page.navigate(`${options.baseAdmin}${pagePath}`, {
          readyExpression: ADMIN_READY,
          timeoutMs: 20000,
        });
        const metrics = await page.evaluate(metricsExpr);
        assert(metrics.pathname === pagePath, `期望路径 ${pagePath}，实际 ${metrics.pathname}`);
        assert(metrics.mainText > 20, `main 内容过少（${metrics.mainText} 字）`);
        assert(
          metrics.scrollWidth <= metrics.innerWidth,
          `横向溢出：scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
        );
        page.assertClean(name);
        const shot = await page.screenshot(fileName);
        return `${metrics.innerWidth}px · main ${metrics.mainText} 字 · 无横向溢出${shot ? ` · ${shot}` : ''}`;
      });
    }

    await runCheck('移动端 390 · 汉堡抽屉开 / 遮罩关', async () => {
      await page.navigate(`${options.baseAdmin}/dashboard`, {
        readyExpression: ADMIN_READY,
        timeoutMs: 20000,
      });
      const clicked = await page.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('header button')).find((b) =>
          /导航|navigation/i.test(b.getAttribute('aria-label') || ''),
        );
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
      assert(clicked, '未找到移动端汉堡按钮');
      const drawerOpen = await page.waitUntil(
        `(() => {
          const aside = document.querySelector('aside');
          return !!aside && aside.classList.contains('translate-x-0');
        })()`,
        { timeoutMs: 4000 },
      );
      assert(drawerOpen, '点击汉堡后侧边抽屉未打开');
      await sleep(450); // 等抽屉滑入动画结束再截图
      const shot = await page.screenshot('mobile-drawer-open');
      const overlayClicked = await page.evaluate(`(() => {
        const overlay = Array.from(document.querySelectorAll('div')).find((el) => {
          const cls = typeof el.className === 'string' ? el.className : '';
          return cls.includes('z-40') && cls.includes('inset-0');
        });
        if (!overlay) return false;
        overlay.click();
        return true;
      })()`);
      assert(overlayClicked, '未找到抽屉遮罩');
      const drawerClosed = await page.waitUntil(
        `(() => {
          const aside = document.querySelector('aside');
          return !!aside && aside.classList.contains('-translate-x-full');
        })()`,
        { timeoutMs: 4000 },
      );
      assert(drawerClosed, '点击遮罩后侧边抽屉未关闭');
      page.assertClean('移动端抽屉');
      return `抽屉打开 / 遮罩关闭 ✓${shot ? ` · ${shot}` : ''}`;
    });

    await runCheck('移动端 390 · 通知铃铛开 / Esc 关', async () => {
      await page.navigate(`${options.baseAdmin}/dashboard`, {
        readyExpression: ADMIN_READY,
        timeoutMs: 20000,
      });
      const clicked = await page.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('header button')).find((b) =>
          /通知|notification/i.test(b.getAttribute('aria-label') || ''),
        );
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
      assert(clicked, '未找到移动端通知铃铛');
      const opened = await page.waitUntil(
        `Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
          /通知|notification/i.test(d.getAttribute('aria-label') || ''),
        )`,
        { timeoutMs: 5000 },
      );
      assert(opened, '点击铃铛后未打开通知面板');
      await sleep(450); // 等面板动画结束再截图
      const shot = await page.screenshot('mobile-notification-panel');
      await page.evaluate(
        `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`,
      );
      const closed = await page.waitUntil(
        `!Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
          /通知|notification/i.test(d.getAttribute('aria-label') || ''),
        )`,
        { timeoutMs: 4000 },
      );
      assert(closed, 'Esc 未关闭移动端通知面板');
      page.assertClean('移动端通知面板');
      return `铃铛打开 / Esc 关闭 ✓${shot ? ` · ${shot}` : ''}`;
    });

    await runCheck('移动端 390 · ⌘K 输入「通知」回车跳转', async () => {
      await page.navigate(`${options.baseAdmin}/dashboard`, {
        readyExpression: ADMIN_READY,
        timeoutMs: 20000,
      });
      await page.evaluate(
        `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true, cancelable: true }))`,
      );
      const paletteOpen = await page.waitUntil(
        `Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
          /命令面板|command palette/i.test(d.getAttribute('aria-label') || ''),
        )`,
        { timeoutMs: 5000 },
      );
      assert(paletteOpen, '移动端 ⌘K 未打开命令面板');
      await page.evaluate(`(() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find((d) =>
          /命令面板|command palette/i.test(d.getAttribute('aria-label') || ''),
        );
        const input = dialog && dialog.querySelector('input');
        if (!input) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '通知');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        return true;
      })()`);
      const suggestionReady = await page.waitUntil(
        `(() => {
          const first = document.querySelector('#cmd-item-0');
          return !!first && /查看通知|notification/i.test(first.innerText || '');
        })()`,
        { timeoutMs: 5000 },
      );
      assert(suggestionReady, '移动端输入「通知」后首项未切换为「查看通知」');
      const paletteShot = await page.screenshot('mobile-command-palette');
      await page.evaluate(`(() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find((d) =>
          /命令面板|command palette/i.test(d.getAttribute('aria-label') || ''),
        );
        const input = dialog && dialog.querySelector('input');
        if (!input) return false;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        return true;
      })()`);
      const navigated = await page.waitUntil(`location.pathname === '/notifications'`, {
        timeoutMs: 8000,
      });
      assert(navigated, `移动端回车后 URL 未跳转到 /notifications（当前 ${await page.evaluate('location.pathname')}）`);
      const contentReady = await page.waitUntil(
        `(document.querySelector('main')?.innerText.trim().length ?? 0) > 10`,
        { timeoutMs: 8000 },
      );
      assert(contentReady, '/notifications 页面未渲染内容');
      const metrics = await page.evaluate(`(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))()`);
      assert(
        metrics.scrollWidth <= metrics.innerWidth,
        `移动端跳转后横向溢出：scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
      );
      page.assertClean('移动端命令面板动作');
      return `URL=/notifications · ${metrics.innerWidth}px 无横向溢出${paletteShot ? ` · ${paletteShot}` : ''}`;
    });
  } finally {
    // 恢复桌面视口与中文界面，避免影响后续/重复运行。
    try {
      await page.evaluate(`localStorage.setItem('lang', 'zh')`);
    } catch {
      /* ignore */
    }
    await page.setViewport({ width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 });
  }
}
