/** 后台 i18n 切换（en → zh，含命令面板分组）。 */
import { ADMIN_READY } from '../config.mjs';
import { assert, truncate } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

export async function checkI18nSwitch(page, options, context) {
  const name = '后台 · i18n 切换（en → zh）';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过 i18n 切换检查');
    return;
  }

  await runCheck(name, async () => {
    try {
      await page.navigate(`${options.baseAdmin}/dashboard`, {
        readyExpression: ADMIN_READY,
        timeoutMs: 20000,
      });
      const initial = await page.evaluate(`(() => ({
        lang: localStorage.getItem('lang'),
        zhSidebar: document.body.innerText.includes('概览'),
        enSidebar: document.body.innerText.includes('Overview'),
      }))()`);
      // 注：Chrome 9222 是共享 profile，其他并行任务可能改写 localStorage.lang；
      // 以页面实际渲染语言为准（admin 注入脚本会在文档加载前强制 zh）。
      assert(
        initial.zhSidebar && !initial.enSidebar,
        `初始界面不是中文（localStorage.lang=${initial.lang}）`,
      );

      const switchedEn = await page.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === 'EN' || (b.getAttribute('title') || '') === 'English',
        );
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
      assert(switchedEn, '未找到语言切换按钮（EN）');
      const enReady = await page.waitUntil(
        `document.documentElement.lang === 'en'
          && document.body.innerText.includes('Overview')
          && document.body.innerText.includes('Feedback')`,
        { timeoutMs: 6000 },
      );
      assert(enReady, '切到英文后 html lang / 侧边栏文案未更新');

      await page.evaluate(
        `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true, cancelable: true }))`,
      );
      const paletteOpen = await page.waitUntil(
        `!!document.querySelector('[role="dialog"][aria-label="Command palette"]')`,
        { timeoutMs: 5000 },
      );
      assert(paletteOpen, '英文环境下 ⌘K 未打开命令面板');
      const paletteEn = await page.evaluate(`(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Command palette"]');
        const text = dialog?.innerText ?? '';
        const lower = text.toLowerCase();
        return { hasQuickActions: lower.includes('quick actions'), hasPages: lower.includes('pages'), text };
      })()`);
      assert(
        paletteEn.hasQuickActions && paletteEn.hasPages,
        `命令面板英文分组缺失（Quick actions / Pages）：${truncate(paletteEn.text, 120)}`,
      );
      await page.evaluate(
        `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`,
      );
      const paletteClosed = await page.waitUntil(
        `!document.querySelector('[role="dialog"][aria-label="Command palette"]')`,
        { timeoutMs: 4000 },
      );
      assert(paletteClosed, 'Esc 未关闭英文命令面板');
      const enShot = await page.screenshot('i18n-en-dashboard');

      const switchedZh = await page.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === '中' || (b.getAttribute('title') || '') === '中文',
        );
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
      assert(switchedZh, '未找到语言切换按钮（中）');
      const zhReady = await page.waitUntil(
        `document.documentElement.lang !== 'en'
          && document.body.innerText.includes('概览')
          && !document.body.innerText.includes('Overview')`,
        { timeoutMs: 6000 },
      );
      assert(zhReady, '切回中文后 html lang / 侧边栏文案未恢复');
      page.assertClean(name);
      const zhShot = await page.screenshot('i18n-zh-dashboard');
      return `en: html lang=en · Overview/Feedback · Quick actions/Pages；已切回 zh（概览）${
        enShot && zhShot ? ` · ${enShot} / ${zhShot}` : ''
      }`;
    } finally {
      // 无论断言是否失败，都尽量把界面与 localStorage 恢复为中文。
      try {
        await page.evaluate(`(() => {
          localStorage.setItem('lang', 'zh');
          if (document.documentElement.lang === 'en') {
            const btn = Array.from(document.querySelectorAll('button')).find(
              (b) => b.textContent.trim() === '中' || (b.getAttribute('title') || '') === '中文',
            );
            btn && btn.click();
          }
          return true;
        })()`);
      } catch {
        /* ignore */
      }
    }
  });
}
