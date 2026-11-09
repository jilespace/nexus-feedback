/** 无障碍基础断言：html lang / 唯一 h1 / 交互元素可访问名称 / img alt。 */
import { ADMIN_READY, DEMO_API_KEY, DEMO_PROJECT_SLUG } from '../config.mjs';
import { assert } from '../util.mjs';
import { runCheck, skipCheck } from '../report.mjs';

/**
 * DOM 审计表达式。
 * 可访问名回退链：aria-label → aria-labelledby → labels → 文本 → title → placeholder/value。
 * （title 属于 ARIA 名称计算回退；placeholder 作为搜索类输入的最后回退，避免误报。）
 * 排除 aria-hidden 祖先、不可见元素与 tabindex="-1"（装饰/程序化控件）。
 */
const AUDIT_EXPR = `(() => {
  const visible = (el) => el.getClientRects().length > 0;
  const excluded = (el) =>
    !!el.closest('[aria-hidden="true"]') ||
    (el.getAttribute('tabindex') || '') === '-1';
  const text = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const labelledBy = (el) => {
    const ids = (el.getAttribute('aria-labelledby') || '').trim().split(/\\s+/).filter(Boolean);
    return ids.map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
  };
  const name = (el) => {
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    const by = labelledBy(el);
    if (by) return by;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      const labels = el.labels ? Array.from(el.labels).map(text).join(' ').trim() : '';
      if (labels) return labels;
      const title = (el.getAttribute('title') || '').trim();
      if (title) return title;
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (['submit', 'button', 'reset'].includes(type)) return (el.value || '').trim();
      return (el.getAttribute('placeholder') || '').trim();
    }
    if (el.tagName === 'IMG') return (el.getAttribute('alt') || '').trim();
    const title = (el.getAttribute('title') || '').trim();
    return text(el) || title;
  };
  const selector =
    'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"]';
  const interactive = Array.from(document.querySelectorAll(selector)).filter(
    (el) => !excluded(el) && visible(el),
  );
  const unnamed = interactive
    .filter((el) => !name(el))
    .map((el) => {
      const cls = typeof el.className === 'string'
        ? el.className.split(' ').filter(Boolean).slice(0, 3).join('.')
        : '';
      return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
    })
    .slice(0, 10);
  const imgs = Array.from(document.querySelectorAll('img')).filter((el) => !excluded(el));
  const missingAlt = imgs
    .filter((el) => el.getAttribute('alt') === null)
    .map((el) => el.getAttribute('src') || '(no src)')
    .slice(0, 10);
  return {
    lang: document.documentElement.lang || '',
    h1Count: document.querySelectorAll('h1').length,
    h1Texts: Array.from(document.querySelectorAll('h1')).map(text).slice(0, 3),
    interactiveCount: interactive.length,
    unnamed,
    imgCount: imgs.length,
    missingAlt,
  };
})()`;

async function auditPage(page, label, url, readyExpression) {
  await page.navigate(url, { readyExpression, timeoutMs: 20000 });
  const audit = await page.evaluate(AUDIT_EXPR);
  assert(
    /^(zh|en)(-[A-Za-z]{2,4})?$/.test(audit.lang),
    `${label}：html lang 非法（"${audit.lang}"）`,
  );
  assert(audit.h1Count === 1, `${label}：h1 数量应为 1，实际 ${audit.h1Count}`);
  assert(
    audit.unnamed.length === 0,
    `${label}：存在无空可访问名称的交互元素 ${audit.unnamed.length} 个（${audit.unnamed.join(', ')}）`,
  );
  assert(
    audit.missingAlt.length === 0,
    `${label}：${audit.missingAlt.length} 个图片缺少 alt（${audit.missingAlt.join(', ')}）`,
  );
  return audit;
}

export async function checkA11yAdmin(page, options, context) {
  const name = '无障碍 · 后台页面基础（dashboard/feedback/notifications）';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过无障碍检查');
    return;
  }

  const pages = [
    ['仪表盘', '/dashboard'],
    ['反馈列表', '/feedback'],
    ['通知中心', '/notifications'],
  ];
  await runCheck(name, async () => {
    let interactiveTotal = 0;
    let imgTotal = 0;
    const langs = new Set();
    for (const [label, pagePath] of pages) {
      const audit = await auditPage(
        page,
        `后台${label}`,
        `${options.baseAdmin}${pagePath}`,
        ADMIN_READY,
      );
      interactiveTotal += audit.interactiveCount;
      imgTotal += audit.imgCount;
      langs.add(audit.lang);
    }
    return `${pages.length} 页 · lang=${[...langs].join('/')} · h1 唯一 ✓ · 交互元素 ${interactiveTotal} 个均有名称 · img ${imgTotal} 个 alt 完整`;
  });
}

export async function checkA11yPublic(page, options) {
  const name = '无障碍 · 公开端基础（board 首页 + submit）';
  const targets = [
    [
      'board 首页',
      `${options.baseBoard}/${DEMO_PROJECT_SLUG}`,
      `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`,
    ],
    [
      'submit 提交页',
      `${options.baseSubmit}/?key=${DEMO_API_KEY}`,
      `!!document.querySelector('form')`,
    ],
  ];

  await runCheck(name, async () => {
    let interactiveTotal = 0;
    let imgTotal = 0;
    const langs = new Set();
    for (const [label, url, readyExpression] of targets) {
      const audit = await auditPage(page, `公开端${label}`, url, readyExpression);
      interactiveTotal += audit.interactiveCount;
      imgTotal += audit.imgCount;
      langs.add(audit.lang);
    }
    return `${targets.length} 页 · lang=${[...langs].join('/')} · h1 唯一 ✓ · 交互元素 ${interactiveTotal} 个均有名称 · img ${imgTotal} 个 alt 完整`;
  });
}
