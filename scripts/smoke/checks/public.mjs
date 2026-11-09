/** 公开端：board（首页/路线图/更新日志/详情）与 submit 提交页。 */
import { assert, httpJson, truncate } from '../util.mjs';
import { runCheck } from '../report.mjs';
import { DEMO_API_KEY, DEMO_PROJECT_SLUG, INFO_EXPR } from '../config.mjs';

export async function checkPublicPages(page, options, context) {
  const boardBase = options.baseBoard;
  const publicPages = [
    { name: '公开端 · board 首页', fileName: 'board-home', path: `/${DEMO_PROJECT_SLUG}` },
    { name: '公开端 · board 路线图', fileName: 'board-roadmap', path: `/${DEMO_PROJECT_SLUG}/roadmap` },
    { name: '公开端 · board 更新日志', fileName: 'board-changelog', path: `/${DEMO_PROJECT_SLUG}/changelog` },
  ];

  for (const publicPage of publicPages) {
    await runCheck(publicPage.name, async () => {
      const url = `${boardBase}${publicPage.path}`;
      const http = await httpJson(url);
      assert(http.status === 200, `HTTP ${http.status}`);
      await page.navigate(url, {
        readyExpression: `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`,
      });
      const info = await page.evaluate(INFO_EXPR);
      assert(info.status === null || info.status === 200, `导航 HTTP ${info.status}`);
      assert((info.title ?? '').trim().length > 0, 'document.title 为空');
      assert(/^https?:\/\//.test(info.canonical ?? ''), '缺少 link[rel="canonical"]');
      assert(info.mainText > 20, `main 内容过少（${info.mainText} 字）`);

      if (publicPage.fileName === 'board-home') {
        const firstHref = await page.evaluate(
          `document.querySelector('main article a[href*="/feedback/"]')?.getAttribute('href') ?? null`,
        );
        if (firstHref) context.detailUrl = new URL(firstHref, boardBase).toString();
      }

      page.assertClean(publicPage.name);
      const shot = await page.screenshot(publicPage.fileName, { full: true });
      return `${truncate(info.title, 40)}${shot ? ` · ${shot}` : ''}`;
    });
  }

  await runCheck('公开端 · board 反馈详情（首页首条推导）', async () => {
    let detailUrl = context.detailUrl;
    let source = '首页首条 href';
    if (!detailUrl) {
      const api = await httpJson(`${options.baseApi}/api/v1/public/${DEMO_PROJECT_SLUG}/feedback?page_size=1`);
      const id = api.json?.data?.items?.[0]?.id;
      if (id) {
        detailUrl = `${boardBase}/${DEMO_PROJECT_SLUG}/feedback/${id}`;
        source = 'API 回退推导';
      }
    }
    assert(detailUrl, '无法从首页或 API 推导反馈详情链接');

    const http = await httpJson(detailUrl);
    assert(http.status === 200, `HTTP ${http.status}`);
    await page.navigate(detailUrl, {
      readyExpression: `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`,
    });
    const info = await page.evaluate(INFO_EXPR);
    assert(info.pathname.includes('/feedback/'), `详情路径异常：${info.pathname}`);
    assert((info.title ?? '').trim().length > 0, 'document.title 为空');
    assert(/^https?:\/\//.test(info.canonical ?? ''), '缺少 link[rel="canonical"]');
    assert(info.mainText > 20, `main 内容过少（${info.mainText} 字）`);
    page.assertClean('board 反馈详情');
    const shot = await page.screenshot('board-detail', { full: true });
    return `${source} → ${info.pathname}${shot ? ` · ${shot}` : ''}`;
  });

  await runCheck('公开端 · submit 提交页表单可见', async () => {
    const url = `${options.baseSubmit}/?key=${DEMO_API_KEY}`;
    const http = await httpJson(url);
    assert(http.status === 200, `HTTP ${http.status}`);
    await page.navigate(url, {
      readyExpression: `!!document.querySelector('form') && !document.querySelector('form')?.dataset?.pending`,
    });
    const info = await page.evaluate(`(() => {
      const form = document.querySelector('form');
      const submit = form?.querySelector('button[type="submit"]');
      return {
        title: document.title,
        form: !!form,
        fields: form ? form.querySelectorAll('input, textarea').length : 0,
        submitText: submit?.textContent?.trim() ?? '',
        submitVisible: submit ? submit.getClientRects().length > 0 : false,
      };
    })()`);
    assert(info.form, '未渲染表单');
    assert(info.fields >= 2, `表单字段过少（${info.fields}）`);
    assert(info.submitVisible, '提交按钮不可见');
    assert(info.submitText.length > 0, '提交按钮无文案');
    page.assertClean('submit 提交页');
    const shot = await page.screenshot('submit', { full: true });
    return `字段 ${info.fields} 个 · 按钮「${info.submitText}」${shot ? ` · ${shot}` : ''}`;
  });
}
