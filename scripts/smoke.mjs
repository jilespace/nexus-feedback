#!/usr/bin/env node
/**
 * Nexus Feedback 端到端冒烟测试（零依赖：Node 24 内置 WebSocket + Chrome CDP）。
 *
 * 覆盖：
 *  1. API：health 200；未认证访问 admin 接口返回 401。
 *  2. 公开端：board 首页 / 路线图 / 更新日志 / 反馈详情、submit 页、widget demo（可选）。
 *  3. 后台：登录接口 → 注入登录态 → 15 个页面渲染 + 命令面板 ⌘K + 通知铃铛。
 *
 * 前置：本地 dev server 已启动（admin 8080 / board 8082 / submit 8081 / api 3000），
 * Chrome 已在 9222 运行或允许脚本自行启动 headless Chrome。
 *
 * 用法：
 *   pnpm smoke
 *   node scripts/smoke.mjs --base-admin=http://localhost:8080 --base-board=http://localhost:8082 \
 *     --base-api=http://localhost:3000 --base-submit=http://localhost:8081
 *
 * 退出码：0 = 全部 PASS/SKIP；1 = 存在 FAIL。
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = path.join(ROOT, '.tools', 'shots', 'smoke');
const DEMO_API_KEY = 'nf_demo_project_key_789';
const DEMO_PROJECT_SLUG = 'demo-project';
const DEMO_PROJECT_ID = 'cms3916d60003v5m8fk4x7bpg';
const LOGIN = { email: 'admin@nexus.dev', password: 'admin123', org_slug: 'demo' };

const ADMIN_READY = `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`;

const INFO_EXPR = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  return {
    title: document.title,
    href: location.href,
    pathname: location.pathname,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    mainText: (document.querySelector('main')?.innerText ?? '').trim().length,
    status: nav && 'responseStatus' in nav ? nav.responseStatus : null,
  };
})()`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const options = {
    baseAdmin: 'http://localhost:8080',
    baseBoard: 'http://localhost:8082',
    baseApi: 'http://localhost:3000',
    baseSubmit: 'http://localhost:8081',
    chromePort: 9222,
    help: false,
  };
  const keyMap = {
    'base-admin': 'baseAdmin',
    'base-board': 'baseBoard',
    'base-api': 'baseApi',
    'base-submit': 'baseSubmit',
    'chrome-port': 'chromePort',
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    const match = arg.match(/^--([a-z-]+)=(.*)$/);
    if (!match) throw new Error(`未知参数: ${arg}（使用 --help 查看用法）`);
    const optionKey = keyMap[match[1]];
    if (!optionKey) throw new Error(`未知参数: ${arg}（使用 --help 查看用法）`);
    const value = String(match[2] ?? '').trim().replace(/\/+$/, '');
    if (!value) throw new Error(`参数 --${match[1]} 需要一个值`);
    options[optionKey] = optionKey === 'chromePort' ? Number(value) : value;
  }
  if (Number.isNaN(options.chromePort)) throw new Error('--chrome-port 需要数字');
  return options;
}

const USAGE = `Nexus Feedback 端到端冒烟测试

用法:
  pnpm smoke
  node scripts/smoke.mjs [参数]

参数:
  --base-admin=<url>   管理后台地址（默认 http://localhost:8080）
  --base-board=<url>   公开看板地址（默认 http://localhost:8082）
  --base-api=<url>     API 地址（默认 http://localhost:3000）
  --base-submit=<url>  公开提交页地址（默认 http://localhost:8081）
  --chrome-port=<port> Chrome CDP 端口（默认 9222，不可用时自动启动 headless Chrome）
  --help               显示本帮助

输出: 每项 PASS / FAIL / SKIP，截图存 .tools/shots/smoke/；存在 FAIL 时退出码为 1。`;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function truncate(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function displayWidth(text) {
  let width = 0;
  for (const char of String(text)) {
    width += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(char) ? 2 : 1;
  }
  return width;
}

function padCell(text, width) {
  const value = truncate(String(text ?? ''), 200);
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
}

async function httpJson(url, init = {}, timeoutMs = 15000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

// ---------------------------------------------------------------------------
// 结果收集
// ---------------------------------------------------------------------------
const results = [];
const startedAt = Date.now();

async function runCheck(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, status: 'PASS', ms: Date.now() - start, detail: detail ? String(detail) : '' });
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      ms: Date.now() - start,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function skipCheck(name, reason) {
  results.push({ name, status: 'SKIP', ms: 0, detail: reason });
}

function failedCount() {
  return results.filter((item) => item.status === 'FAIL').length;
}

// ---------------------------------------------------------------------------
// Chrome / CDP
// ---------------------------------------------------------------------------
const chromeCommand = {
  started: null,
  async probe(port) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) return null;
      const version = await response.json();
      return version.webSocketDebuggerUrl ?? null;
    } catch {
      return null;
    }
  },
  resolveChromePath() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const candidates =
      process.platform === 'win32'
        ? [
            'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  },
  async start(port) {
    const chromePath = this.resolveChromePath();
    if (!chromePath) {
      throw new Error(
        'Chrome 未在运行，且未找到 chrome 可执行文件；请先启动 Chrome 或设置 CHROME_PATH 环境变量',
      );
    }
    const profileDir = mkdtempSync(path.join(os.tmpdir(), 'nexus-smoke-chrome-'));
    const child = spawn(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        'about:blank',
      ],
      { stdio: 'ignore', windowsHide: true },
    );
    this.started = { child, profileDir };
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const webSocketDebuggerUrl = await this.probe(port);
      if (webSocketDebuggerUrl) return webSocketDebuggerUrl;
      await sleep(300);
    }
    throw new Error(`headless Chrome 启动后 20s 内未就绪（端口 ${port}）`);
  },
  async ensure(port) {
    const existing = await this.probe(port);
    if (existing) return existing;
    return this.start(port);
  },
  async stop() {
    if (!this.started) return;
    const { child, profileDir } = this.started;
    this.started = null;
    // 优先用 CDP 优雅关闭整个浏览器（node 拿到的 pid 可能只是 Chrome 的启动器进程）。
    if (this.client) {
      try {
        await this.client.send('Browser.close');
      } catch {
        /* 浏览器可能已关闭 */
      }
      this.client = null;
      await sleep(800);
    }
    try {
      if (process.platform === 'win32' && child.pid) {
        execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          timeout: 15000,
        });
      } else if (child.exitCode === null) {
        child.kill('SIGTERM');
      }
    } catch {
      /* 启动器进程可能已退出，忽略 */
    }
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode) return resolve();
      const timer = setTimeout(resolve, 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await sleep(300);
    if (profileDir) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          rmSync(profileDir, { recursive: true, force: true });
          break;
        } catch {
          await sleep(400);
        }
      }
    }
  },
};

class CdpClient {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    webSocket.onmessage = (event) => this.handleMessage(event);
  }

  static async connect(webSocketDebuggerUrl) {
    const webSocket = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      webSocket.onopen = () => resolve();
      webSocket.onerror = () => reject(new Error(`无法连接 CDP: ${webSocketDebuggerUrl}`));
    });
    return new CdpClient(webSocket);
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result ?? {});
      return;
    }
    const handlers = this.listeners.get(message.method);
    if (handlers) {
      for (const handler of [...handlers]) handler(message.params ?? {}, message.sessionId);
    }
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.webSocket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(handler);
    return () => this.listeners.get(method)?.delete(handler);
  }

  waitForEvent(method, timeoutMs = 30000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, timeoutMs);
      const unsubscribe = this.on(method, (params) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(params);
      });
    });
  }

  close() {
    try {
      this.webSocket.close();
    } catch {
      /* ignore */
    }
  }
}

function formatConsoleError(params) {
  const args = (params.args ?? [])
    .map((arg) => arg.value ?? arg.description ?? arg.unserializableValue ?? '')
    .filter((value) => value !== '');
  return `${args.join(' ')}`.trim() || 'console.error()';
}

class PageSession {
  constructor(client) {
    this.client = client;
    this.sessionId = null;
    this.targetId = null;
    this.diagnostics = { consoleErrors: [], exceptions: [], logErrors: [], networkFailures: [] };
  }

  async init() {
    const { targetId } = await this.client.send('Target.createTarget', { url: 'about:blank' });
    this.targetId = targetId;
    const { sessionId } = await this.client.send('Target.attachToTarget', { targetId, flatten: true });
    this.sessionId = sessionId;

    const onSession = (method, handler) => {
      this.client.on(method, (params, eventSessionId) => {
        if (!eventSessionId || eventSessionId === this.sessionId) handler(params);
      });
    };

    onSession('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') this.diagnostics.consoleErrors.push(formatConsoleError(params));
    });
    onSession('Runtime.exceptionThrown', (params) => {
      const details = params.exceptionDetails;
      const description =
        details?.exception?.description ?? details?.exception?.value ?? details?.text ?? '页面异常';
      this.diagnostics.exceptions.push(String(description).slice(0, 500));
    });
    onSession('Log.entryAdded', (params) => {
      const entry = params.entry;
      if (!entry || entry.level !== 'error') return;
      if (entry.source === 'network') return; // 资源 404/401 由页面断言覆盖，避免 favicon 等噪音
      this.diagnostics.logErrors.push(`${entry.source}: ${entry.text}`.slice(0, 500));
    });
    onSession('Network.loadingFailed', (params) => {
      if (/net::ERR_ABORTED/.test(params.errorText ?? '')) return;
      this.diagnostics.networkFailures.push(`${params.type ?? 'unknown'} ${params.errorText ?? ''}`.trim());
    });

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Log.enable');
    await this.send('Network.setCacheDisabled', { cacheDisabled: true });
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  send(method, params = {}) {
    return this.client.send(method, params, this.sessionId);
  }

  resetDiagnostics() {
    this.diagnostics = { consoleErrors: [], exceptions: [], logErrors: [], networkFailures: [] };
  }

  async evaluate(expression, { awaitPromise = true } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const description =
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? '脚本异常';
      throw new Error(String(description).slice(0, 500));
    }
    return result.result?.value ?? null;
  }

  async waitUntil(expression, { timeoutMs = 15000, intervalMs = 150 } = {}) {
    const deadline = Date.now() + timeoutMs;
    const probe = `(() => { try { return Boolean(${expression}); } catch (error) { return false; } })()`;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(probe)) return true;
      } catch {
        /* 页面跳转/刷新期间执行上下文可能被销毁，继续轮询 */
      }
      await sleep(intervalMs);
    }
    return false;
  }

  async navigate(url, { readyExpression, timeoutMs = 15000, settleMs = 350 } = {}) {
    this.resetDiagnostics();
    const loadEvent = this.client.waitForEvent('Page.loadEventFired', 30000);
    await this.send('Page.navigate', { url });
    await loadEvent;
    if (readyExpression) {
      const ready = await this.waitUntil(readyExpression, { timeoutMs });
      if (!ready) throw new Error(`等待页面内容超时（${timeoutMs}ms）：${url}`);
    }
    await sleep(settleMs);
  }

  async addInitScript(source) {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async screenshot(fileName, { full = false } = {}) {
    try {
      mkdirSync(SHOT_DIR, { recursive: true });
      const params = { format: 'png', captureBeyondViewport: full };
      if (full) {
        const metrics = await this.send('Page.getLayoutMetrics');
        const size = metrics.cssContentSize ?? metrics.contentSize;
        params.clip = {
          x: 0,
          y: 0,
          width: Math.min(Math.ceil(size.width), 1600),
          height: Math.min(Math.ceil(size.height), 4000),
          scale: 1,
        };
      }
      const screenshot = await this.send('Page.captureScreenshot', params);
      const filePath = path.join(SHOT_DIR, `${fileName}.png`);
      writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
      return path.relative(ROOT, filePath);
    } catch {
      return null; // 截图失败不影响冒烟结论
    }
  }

  assertClean(label) {
    const { consoleErrors, exceptions, logErrors } = this.diagnostics;
    if (consoleErrors.length > 0) {
      throw new Error(`${label} 出现 console error：${consoleErrors.slice(0, 3).join(' | ')}`);
    }
    if (exceptions.length > 0) {
      throw new Error(`${label} 出现未捕获异常：${exceptions.slice(0, 2).join(' | ')}`);
    }
    if (logErrors.length > 0) {
      throw new Error(`${label} 出现页面错误日志：${logErrors.slice(0, 3).join(' | ')}`);
    }
  }

  async close() {
    try {
      if (this.targetId) await this.client.send('Target.closeTarget', { targetId: this.targetId });
    } catch {
      /* ignore */
    }
  }
}

function diagnosticsSummary(page) {
  const { consoleErrors, exceptions, logErrors, networkFailures } = page.diagnostics;
  const parts = [];
  if (consoleErrors.length) parts.push(`console errors: ${consoleErrors.length}`);
  if (exceptions.length) parts.push(`exceptions: ${exceptions.length}`);
  if (logErrors.length) parts.push(`log errors: ${logErrors.length}`);
  if (networkFailures.length) parts.push(`network failures: ${networkFailures.length}`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// 检查项
// ---------------------------------------------------------------------------
async function checkApi(options) {
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

async function checkPublicPages(page, options, context) {
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

async function waitForHttp(url, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return true;
    } catch {
      /* 继续等待 */
    }
    await sleep(300);
  }
  return false;
}

async function checkWidget(page, options, context) {
  const serverPath = path.join(ROOT, '.tools', 'widget-demo', 'server.mjs');
  const isRunning = await (async () => {
    try {
      const response = await fetch('http://127.0.0.1:8099/demo.html', { signal: AbortSignal.timeout(1200) });
      return response.ok;
    } catch {
      return false;
    }
  })();

  if (!existsSync(serverPath)) {
    skipCheck('公开端 · widget demo 嵌入', '未找到 .tools/widget-demo/server.mjs（临时验证目录，按需跳过）');
    return;
  }

  await runCheck('公开端 · widget demo 嵌入', async () => {
    if (!isRunning) {
      context.widgetProcess = spawn(process.execPath, [serverPath], {
        cwd: ROOT,
        stdio: 'ignore',
        windowsHide: true,
      });
      const ready = await waitForHttp('http://127.0.0.1:8099/demo.html', 12000);
      assert(ready, 'widget demo 服务器未能在 12s 内启动（端口 8099）');
    }

    await page.navigate('http://127.0.0.1:8099/demo.html', {
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
    return `launcher「${launcher.label}」· 面板 ${panel.width}px · tooltip「${truncate(launcher.tooltip, 12)}」${shot ? ` · ${shot}` : ''}`;
  });
}

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

async function checkAdmin(page, options, context) {
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

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
function printReport(totalMs) {
  const rows = results.map((result, index) => ({
    index: String(index + 1),
    status: result.status,
    name: result.name,
    ms: `${result.ms}ms`,
    detail: result.detail,
  }));
  const nameWidth = Math.max(
    displayWidth('检查项'),
    ...rows.map((row) => displayWidth(truncate(row.name, 34))),
    34,
  );
  const detailWidth = Math.max(40, ...rows.map((row) => displayWidth(truncate(row.detail, 90))));

  console.log('');
  console.log(
    `${padCell('#', 3)}  ${padCell('结果', 5)}  ${padCell('检查项', nameWidth)}  ${padCell('耗时', 7)}  说明`,
  );
  console.log(
    `${'-'.repeat(3)}  ${'-'.repeat(5)}  ${'-'.repeat(nameWidth)}  ${'-'.repeat(7)}  ${'-'.repeat(Math.min(detailWidth, 90))}`,
  );
  for (const row of rows) {
    console.log(
      `${padCell(row.index, 3)}  ${padCell(row.status, 5)}  ${padCell(row.name, nameWidth)}  ${padCell(row.ms, 7)}  ${truncate(row.detail, 90)}`,
    );
  }

  const failed = results.filter((result) => result.status === 'FAIL');
  const skipped = results.filter((result) => result.status === 'SKIP');
  if (failed.length > 0) {
    console.log('\n失败详情：');
    for (const result of failed) console.log(`  ❌ ${result.name}\n     ${result.detail}`);
  }
  if (skipped.length > 0) {
    console.log('\n跳过项：');
    for (const result of skipped) console.log(`  ⏭️  ${result.name} — ${result.detail}`);
  }

  const passCount = results.filter((result) => result.status === 'PASS').length;
  console.log(
    `\n合计 ${results.length} 项：PASS ${passCount} / FAIL ${failed.length} / SKIP ${skipped.length}，用时 ${(totalMs / 1000).toFixed(1)}s`,
  );
  console.log(`截图目录：${path.relative(ROOT, SHOT_DIR)}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  console.log('Nexus Feedback 端到端冒烟测试');
  console.log(
    `admin=${options.baseAdmin}  board=${options.baseBoard}  submit=${options.baseSubmit}  api=${options.baseApi}`,
  );

  const context = { detailUrl: null, auth: null, projectId: DEMO_PROJECT_ID, widgetProcess: null };
  let client = null;
  let page = null;

  try {
    const webSocketDebuggerUrl = await chromeCommand.ensure(options.chromePort);
    client = await CdpClient.connect(webSocketDebuggerUrl);
    chromeCommand.client = client;
    page = new PageSession(client);
    await page.init();

    await checkApi(options);
    await checkPublicPages(page, options, context);
    await checkWidget(page, options, context);
    await checkAdmin(page, options, context);
  } catch (error) {
    results.push({
      name: '环境初始化',
      status: 'FAIL',
      ms: 0,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (context.widgetProcess) {
      try {
        context.widgetProcess.kill();
      } catch {
        /* ignore */
      }
    }
    await chromeCommand.stop();
    if (page) await page.close().catch(() => {});
    client?.close();
  }

  printReport(Date.now() - startedAt);
  return failedCount() > 0 ? 1 : 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error('冒烟脚本崩溃:', error);
    process.exitCode = 1;
  });

// 兜底：异常退出时也尽量回收本脚本启动的 headless Chrome。
process.on('exit', () => {
  const started = chromeCommand.started;
  if (started?.child?.pid && process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(started.child.pid), '/T', '/F'], {
        stdio: 'ignore',
        timeout: 8000,
      });
    } catch {
      /* ignore */
    }
  }
});
