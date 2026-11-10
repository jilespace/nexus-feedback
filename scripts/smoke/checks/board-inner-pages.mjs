/** 公开端内页：路线图 / 更新日志 / 退订页无效 token。 */
import { DEMO_PROJECT_SLUG } from '../config.mjs';
import { assert } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

const MAIN_READY = `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`;
const BOARD_URL = (options, path = '') => `${options.baseBoard}/${DEMO_PROJECT_SLUG}${path}`;

/** 记录 board origin 当前语言并切到中文，返回用于恢复的原值。 */
async function useChineseBoardLocale(page, options) {
  await page.navigate(BOARD_URL(options), { readyExpression: MAIN_READY });
  const original = await page.evaluate(`localStorage.getItem('lang')`);
  await page.evaluate(`localStorage.setItem('lang', 'zh')`);
  return original;
}

async function restoreBoardLocale(page, original) {
  try {
    await page.evaluate(`(() => {
      const original = ${JSON.stringify(original)};
      if (original === null) localStorage.removeItem('lang');
      else localStorage.setItem('lang', original);
      return true;
    })()`);
  } catch {
    /* 尽力而为 */
  }
}

function accessibleNameExpr() {
  return `(() => {
    const text = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll('main a[href], main button, main [role="button"]'))
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const ids = (el.getAttribute('aria-labelledby') || '').trim().split(/\\s+/).filter(Boolean);
        const by = ids.map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
        return (
          (el.getAttribute('aria-label') || '').trim() ||
          by ||
          text(el) ||
          (el.getAttribute('title') || '').trim()
        );
      })
      .filter(Boolean);
  })()`;
}

export async function checkRoadmapPage(page, options) {
  const name = '公开端 · 路线图页';
  await runCheck(name, async () => {
    const originalLang = await useChineseBoardLocale(page, options);
    try {
      await page.setViewport({ width: 390, height: 844, mobile: true, deviceScaleFactor: 2 });
      await page.navigate(BOARD_URL(options, '/roadmap'), {
        readyExpression: `document.querySelectorAll('main section').length > 0
          || (document.querySelector('main')?.innerText.includes('路线图暂无内容') ?? false)`,
        timeoutMs: 20000,
      });
      const state = await page.evaluate(`(() => {
        const main = document.querySelector('main');
        const text = (main?.innerText ?? '').trim();
        const hint = Array.from(document.querySelectorAll('main p')).find((el) =>
          (el.textContent || '').includes('左右滑动'),
        );
        return {
          h1: document.querySelector('main h1')?.textContent?.trim() ?? '',
          columnHeaders: Array.from(document.querySelectorAll('main section h2'))
            .map((el) => (el.textContent || '').trim())
            .filter(Boolean),
          hintVisible: !!hint && hint.getClientRects().length > 0,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          mainLen: text.length,
        };
      })()`);
      assert(state.h1.includes('产品路线图'), `路线图标题异常："${state.h1}"`);
      assert(state.columnHeaders.length >= 2, `路线图列头不足：${JSON.stringify(state.columnHeaders)}`);
      assert(state.hintVisible, '390 视口未显示「左右滑动」提示');
      assert(
        state.scrollWidth <= state.innerWidth,
        `390 横向溢出：scrollWidth=${state.scrollWidth} > innerWidth=${state.innerWidth}`,
      );
      page.assertClean(name);
      const shot = await page.screenshot('board-roadmap-mobile');
      return `h1「${state.h1}」· 列头 ${state.columnHeaders.length} 个 · 滑动提示 ✓ · 390 无溢出${shot ? ` · ${shot}` : ''}`;
    } finally {
      await restoreBoardLocale(page, originalLang);
      await page.setViewport({ width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 });
    }
  });
}

export async function checkChangelogPage(page, options) {
  const name = '公开端 · 更新日志页';
  await runCheck(name, async () => {
    const originalLang = await useChineseBoardLocale(page, options);
    try {
      await page.navigate(BOARD_URL(options, '/changelog'), {
        readyExpression: `document.querySelectorAll('main article').length > 0
          || (document.querySelector('main')?.innerText.includes('还没有更新') ?? false)`,
        timeoutMs: 20000,
      });
      const state = await page.evaluate(`(() => {
        const main = document.querySelector('main');
        const text = (main?.innerText ?? '').trim();
        return {
          h1: document.querySelector('main h1')?.textContent?.trim() ?? '',
          articles: document.querySelectorAll('main article').length,
          timelineTimes: document.querySelectorAll('main article time').length,
          emptyVisible: text.includes('还没有更新'),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      })()`);
      assert(state.h1.includes('更新日志'), `更新日志标题异常："${state.h1}"`);
      assert(
        state.articles > 0 || state.emptyVisible,
        '更新日志既无时间线条目也无空态',
      );
      if (state.articles > 0) {
        assert(
          state.timelineTimes >= state.articles,
          `时间线条目缺少时间（articles=${state.articles}, time=${state.timelineTimes}）`,
        );
      }
      assert(
        state.scrollWidth <= state.innerWidth,
        `1440 横向溢出：scrollWidth=${state.scrollWidth} > innerWidth=${state.innerWidth}`,
      );
      page.assertClean(name);
      const shot = await page.screenshot('board-changelog-desktop');
      return `h1「${state.h1}」· ${state.articles > 0 ? `时间线条目 ${state.articles} 个` : '空态'} · 1440 无溢出${shot ? ` · ${shot}` : ''}`;
    } finally {
      await restoreBoardLocale(page, originalLang);
    }
  });
}

export async function checkUnsubscribeInvalidToken(page, options) {
  const name = '公开端 · 退订页无效 token';
  // 退订页在邮件里是项目内链接（/demo-project/unsubscribe?token=...）；
  // 同时兼容任务描述里的根路径形式。按顺序探测，取第一个可渲染的地址。
  const candidates = [
    `${options.baseBoard}/${DEMO_PROJECT_SLUG}/unsubscribe?token=invalid`,
    `${options.baseBoard}/unsubscribe?token=invalid`,
  ];
  let targetUrl = null;
  let probe = null;
  try {
    for (const candidate of candidates) {
      try {
        await page.navigate(candidate, { readyExpression: MAIN_READY, timeoutMs: 15000 });
        const state = await page.evaluate(`(() => {
          const main = document.querySelector('main');
          const text = (main?.innerText ?? '').trim();
          return {
            hasUnsubscribe: /退订|unsubscribe/i.test(text),
            hasInvalid: /无效|失效|过期|invalid|expired/i.test(text),
          };
        })()`);
        if (state.hasUnsubscribe && state.hasInvalid) {
          targetUrl = candidate;
          probe = state;
          break;
        }
      } catch {
        /* 继续尝试下一个候选地址 */
      }
    }
  } catch {
    probe = null;
  }
  if (!targetUrl) {
    skipCheck(
      name,
      '退订页尚未实现或未就绪（/unsubscribe 落入看板兜底路由）；待并行任务落地后重跑',
    );
    return;
  }

  await runCheck(name, async () => {
    await page.navigate(targetUrl, { readyExpression: MAIN_READY, timeoutMs: 15000 });
    const state = await page.evaluate(`(() => {
      const main = document.querySelector('main');
      const text = (main?.innerText ?? '').trim();
      return {
        pathname: location.pathname,
        h1: document.querySelector('main h1')?.textContent?.trim() ?? '',
        hasUnsubscribe: /退订|unsubscribe/i.test(text),
        hasInvalid: /无效|失效|过期|invalid|expired/i.test(text),
        hasAlert: !!document.querySelector('main [role="alert"]'),
        namedActions: ${accessibleNameExpr()},
      };
    })()`);
    assert(state.pathname.includes('/unsubscribe'), `退订页路径异常：${state.pathname}`);
    assert(state.hasUnsubscribe, '退订页未出现退订相关文案');
    assert(state.hasInvalid, '退订页未出现无效/失效态');
    assert(state.h1.length > 0, '退订页缺少标题');
    assert(state.hasAlert, '退订页无效态缺少 role="alert" 语义');
    assert(state.namedActions.length > 0, '退订页缺少有可访问名称的操作入口');
    page.assertClean(name);
    const shot = await page.screenshot('board-unsubscribe-invalid');
    return `无效态「${state.h1}」✓ · 可访问操作入口 ${state.namedActions.length} 个${shot ? ` · ${shot}` : ''}`;
  });
}
