/** 公开端 UI：看板订阅的“已订阅”回显（localStorage 驱动，不实际发请求）。 */
import { DEMO_PROJECT_SLUG } from '../config.mjs';
import { assert } from '../util.mjs';
import { runCheck } from '../report.mjs';

export async function checkBoardSubscriptionUi(page, options) {
  const name = '公开端 · 看板订阅已订阅态';
  const boardUrl = `${options.baseBoard}/${DEMO_PROJECT_SLUG}`;
  const storageKey = `board-subscribe-${DEMO_PROJECT_SLUG}`;
  const email = 'smoke-sub@nexus.test';
  const ready = `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`;

  await runCheck(name, async () => {
    let originalSubscription = null;
    let originalLang = null;
    try {
      await page.navigate(boardUrl, { readyExpression: ready });
      const originals = await page.evaluate(`(() => ({
        subscription: localStorage.getItem(${JSON.stringify(storageKey)}),
        lang: localStorage.getItem('lang'),
      }))()`);
      originalSubscription = originals.subscription;
      originalLang = originals.lang;

      await page.evaluate(`(() => {
        localStorage.setItem('lang', 'zh');
        localStorage.setItem(
          ${JSON.stringify(storageKey)},
          ${JSON.stringify(JSON.stringify({ email, type: 'weekly_digest' }))},
        );
        return true;
      })()`);
      await page.navigate(boardUrl, { readyExpression: ready });

      const state = await page.evaluate(`(() => {
        const text = document.body.innerText || '';
        const buttons = Array.from(document.querySelectorAll('button'));
        const unsubscribe = buttons.find(
          (button) =>
            (button.textContent || '').includes('退订') ||
            (button.getAttribute('aria-label') || '').includes('退订'),
        );
        return {
          subscribedLabel: text.includes('已订阅'),
          emailVisible: text.includes(${JSON.stringify(email)}),
          unsubscribeVisible: !!unsubscribe,
          unsubscribeText: unsubscribe ? (unsubscribe.textContent || '').trim() : '',
        };
      })()`);
      assert(state.subscribedLabel, '看板未渲染「已订阅」状态');
      assert(state.emailVisible, `看板未显示已订阅邮箱（${email}）`);
      assert(state.unsubscribeVisible, '看板未显示退订按钮');
      page.assertClean(name);
      return `已订阅态回显 ✓ · 邮箱 ${email} · 退订按钮「${state.unsubscribeText}」`;
    } finally {
      try {
        await page.evaluate(`(() => {
          const key = ${JSON.stringify(storageKey)};
          const original = ${JSON.stringify(originalSubscription)};
          if (original === null) localStorage.removeItem(key);
          else localStorage.setItem(key, original);
          const lang = ${JSON.stringify(originalLang)};
          if (lang === null) localStorage.removeItem('lang');
          else localStorage.setItem('lang', lang);
          return true;
        })()`);
      } catch {
        /* 尽力而为 */
      }
    }
  });
}
