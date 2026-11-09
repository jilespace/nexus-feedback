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
const WIDGET_DEMO_SERVER = path.join(ROOT, 'packages', 'widget', 'demo', 'server.mjs');
const WIDGET_DIST_IIFE = path.join(ROOT, 'packages', 'widget', 'dist', 'nexus-feedback-widget.iife.js');
const WIDGET_DEMO_ORIGIN = 'http://127.0.0.1:8099';
const WIDGET_DEMO_URL = `${WIDGET_DEMO_ORIGIN}/demo/`;

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
    this.port = port;
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
    const port = this.port;
    this.started = null;
    // 优先用 CDP 优雅关闭整个浏览器（node 拿到的 pid 可能只是 Chrome 的启动器进程）。
    if (this.client) {
      try {
        await this.client.send('Browser.close');
      } catch {
        /* 浏览器关闭时连接会先断开，属于预期 */
      }
      this.client = null;
      // 等端口释放，确保随后可以清理临时 profile。
      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
            signal: AbortSignal.timeout(400),
          });
          if (!response.ok) break;
        } catch {
          break;
        }
        await sleep(200);
      }
      await sleep(300);
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
    webSocket.onclose = () => this.rejectPending(new Error('CDP 连接已关闭'));
    webSocket.onerror = () => this.rejectPending(new Error('CDP 连接出错'));
  }

  /** 连接断开时让所有未决请求立即失败，避免 await 永久挂起。 */
  rejectPending(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
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

  async setViewport({ width, height, mobile = false, deviceScaleFactor = 1 }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile,
    });
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

async function checkWidget(page, _options, context) {
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

/** 按标题尽力检索并软删除测试反馈，用于失败时的兜底清理。 */
async function deleteFeedbackByTitle(options, token, title) {
  const headers = { Authorization: `Bearer ${token}` };
  let deleted = 0;
  try {
    const search = await httpJson(
      `${options.baseApi}/api/v1/admin/feedback?keyword=${encodeURIComponent(title)}&page_size=20`,
      { headers },
    );
    for (const item of search.json?.data?.items ?? []) {
      if (item.title !== title) continue;
      try {
        const response = await httpJson(`${options.baseApi}/api/v1/admin/feedback/${item.id}`, {
          method: 'DELETE',
          headers,
        });
        if (response.status === 200 && response.json?.code === 0) deleted += 1;
      } catch {
        /* 尽力而为 */
      }
    }
  } catch {
    /* 尽力而为 */
  }
  return deleted;
}

/** 清理冒烟产生的通知（标题含 [SMOKE]），避免重复运行时堆积。 */
async function deleteSmokeNotifications(options, token) {
  const headers = { Authorization: `Bearer ${token}` };
  let deleted = 0;
  try {
    const list = await httpJson(`${options.baseApi}/api/v1/org/notifications?page_size=100`, {
      headers,
    });
    for (const item of list.json?.data?.items ?? []) {
      if (!String(item.title).includes('[SMOKE]') && !String(item.body ?? '').includes('[SMOKE]')) {
        continue;
      }
      try {
        const response = await httpJson(`${options.baseApi}/api/v1/org/notifications/${item.id}`, {
          method: 'DELETE',
          headers,
        });
        if (response.status === 200 && response.json?.code === 0) deleted += 1;
      } catch {
        /* 尽力而为 */
      }
    }
  } catch {
    /* 尽力而为 */
  }
  return deleted;
}

async function checkWriteFlows(page, options, context) {
  const checkNames = [
    '写操作 · 公开提交页提交 → 后台检索 → 软删除',
    '写操作 · 通知触发 → unread → read-all → 0',
  ];
  if (!context.auth) {
    for (const name of checkNames) skipCheck(name, '未建立后台登录态，跳过写操作检查');
    return;
  }

  const token = context.auth.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  await runCheck(checkNames[0], async () => {
    const title = `[SMOKE] 提交链路 ${Date.now()}`;
    const content = `由 pnpm smoke 于 ${new Date().toISOString()} 自动提交，用于验证公开提交页写入与后台检索链路，测试结束后会自动软删除。`;
    let feedbackId = null;
    let cleaned = false;
    try {
      await page.navigate(`${options.baseSubmit}/?key=${DEMO_API_KEY}`, {
        readyExpression: `!!document.querySelector('#feedback-title')`,
      });
      await page.evaluate(`(() => {
        const setValue = (element, value) => {
          const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setValue(document.querySelector('#feedback-title'), ${JSON.stringify(title)});
        setValue(document.querySelector('#feedback-content'), ${JSON.stringify(content)});
        return true;
      })()`);
      await sleep(250);
      await page.evaluate(`document.querySelector('button[type="submit"]')?.click() ?? true`);
      const submitted = await page.waitUntil(`document.body.innerText.includes('反馈已收到')`, {
        timeoutMs: 15000,
      });
      assert(submitted, '提交后未进入成功态');

      const searchUrl = `${options.baseApi}/api/v1/admin/feedback?keyword=${encodeURIComponent(title)}&page_size=20`;
      const search = await httpJson(searchUrl, { headers: authHeaders });
      assert(search.status === 200 && search.json?.code === 0, `后台检索失败 HTTP ${search.status}`);
      const found = (search.json?.data?.items ?? []).find((item) => item.title === title);
      assert(found?.id, '后台未检索到刚提交的反馈');
      feedbackId = found.id;

      const deleted = await httpJson(`${options.baseApi}/api/v1/admin/feedback/${feedbackId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(deleted.status === 200 && deleted.json?.code === 0, `软删除失败 HTTP ${deleted.status}`);
      cleaned = true;

      const after = await httpJson(searchUrl, { headers: authHeaders });
      const stillExists = (after.json?.data?.items ?? []).some((item) => item.title === title);
      assert(!stillExists, '软删除后仍能检索到该测试反馈');
      const shot = await page.screenshot('write-submit-success', { full: true });
      return `id=${feedbackId} · 检索确认 ✓ · 软删除 ✓${shot ? ` · ${shot}` : ''}`;
    } finally {
      if (!cleaned) await deleteFeedbackByTitle(options, token, title).catch(() => {});
      await deleteSmokeNotifications(options, token).catch(() => {});
    }
  });

  await runCheck(checkNames[1], async () => {
    const title = `[SMOKE] 通知链路 ${Date.now()}`;
    let feedbackId = null;
    let readAllDone = false;

    const unreadCount = async () => {
      const response = await httpJson(`${options.baseApi}/api/v1/org/notifications/unread-count`, {
        headers: authHeaders,
      });
      assert(response.status === 200 && response.json?.code === 0, `unread-count 失败 HTTP ${response.status}`);
      return Number(response.json?.data?.count ?? 0);
    };

    try {
      // 先清空基线未读，确保断言的是本轮创建触发的新通知。
      const baseline = await httpJson(`${options.baseApi}/api/v1/org/notifications/read-all`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert(baseline.status === 200 && baseline.json?.code === 0, '通知基线 read-all 失败');

      const created = await httpJson(`${options.baseApi}/api/v1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DEMO_API_KEY },
        body: JSON.stringify({
          title,
          content: 'pnpm smoke 自动创建的测试反馈，用于验证创建通知 → 未读数 → 全部已读链路。',
          category: 'other',
          priority: 'medium',
          source: 'api',
        }),
      });
      assert(created.status === 201 && created.json?.code === 0, `创建公开反馈失败 HTTP ${created.status}`);
      feedbackId = created.json?.data?.id ?? null;
      assert(feedbackId, '创建公开反馈未返回 id');

      let unread = 0;
      const unreadDeadline = Date.now() + 8000;
      while (Date.now() < unreadDeadline) {
        unread = await unreadCount();
        if (unread > 0) break;
        await sleep(250);
      }
      assert(unread > 0, `创建反馈后 unread-count 未增加（${unread}）`);

      const readAll = await httpJson(`${options.baseApi}/api/v1/org/notifications/read-all`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert(readAll.status === 200 && readAll.json?.code === 0, `read-all 失败 HTTP ${readAll.status}`);
      readAllDone = true;

      let after = -1;
      const readDeadline = Date.now() + 4000;
      while (Date.now() < readDeadline) {
        after = await unreadCount();
        if (after === 0) break;
        await sleep(200);
      }
      assert(after === 0, `read-all 后 unread-count=${after}`);
      return `unread ${unread} → read-all → 0 · feedback=${feedbackId}`;
    } finally {
      if (!readAllDone) {
        try {
          await httpJson(`${options.baseApi}/api/v1/org/notifications/read-all`, {
            method: 'POST',
            headers: authHeaders,
          });
        } catch {
          /* 尽力而为 */
        }
      }
      if (feedbackId) {
        try {
          await httpJson(`${options.baseApi}/api/v1/admin/feedback/${feedbackId}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
        } catch {
          /* 尽力而为 */
        }
      } else {
        await deleteFeedbackByTitle(options, token, title).catch(() => {});
      }
      await deleteSmokeNotifications(options, token).catch(() => {});
    }
  });
}

/** 统一响应信封：{ code: number, data: any, message: string }。 */
function assertEnvelope(label, body) {
  assert(body && typeof body === 'object', `${label} 响应不是 JSON 对象`);
  assert(typeof body.code === 'number', `${label} 缺少数字 code（got ${typeof body.code}）`);
  assert(Object.prototype.hasOwnProperty.call(body, 'data'), `${label} 缺少 data 字段`);
  assert(typeof body.message === 'string', `${label} 缺少 message 字符串`);
}

async function checkApiContract(options, context) {
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

async function checkCsvImport(options, context) {
  const name = '写操作 · CSV 导入 dry_run → commit → 检索 → 软删除';
  if (!context.auth) {
    skipCheck(name, '未建立后台登录态，跳过 CSV 导入检查');
    return;
  }

  const token = context.auth.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };
  const projectId = context.projectId ?? DEMO_PROJECT_ID;
  const stamp = Date.now();
  const dryRunTitle = `[SMOKE] 导入 dry-run ${stamp}`;
  const commitTitle = `[SMOKE] 导入 commit ${stamp}`;
  const importUrl = `${options.baseApi}/api/v1/admin/feedback/import`;
  const searchUrl = (title) =>
    `${options.baseApi}/api/v1/admin/feedback?keyword=${encodeURIComponent(title)}&page_size=10`;

  await runCheck(name, async () => {
    let importedId = null;
    try {
      // a) 混合 dry-run：1 有效 + 1 无效分类，断言索引且不写库。
      const mixed = await httpJson(importUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          project_id: projectId,
          dry_run: true,
          rows: [
            { title: dryRunTitle, content: 'dry_run 有效行，不应写入数据库。', category: 'other' },
            { title: '[SMOKE] 导入无效行', content: '分类非法，应被标记为无效。', category: 'nope' },
          ],
        }),
      });
      assert(mixed.status === 200, `混合 dry_run HTTP ${mixed.status}`);
      assert(mixed.json?.code === 0, `混合 dry_run code=${mixed.json?.code}`);
      const mixedData = mixed.json?.data ?? {};
      assert(mixedData.total === 2, `dry_run total=${mixedData.total}（期望 2）`);
      assert(mixedData.valid === 1, `dry_run valid=${mixedData.valid}（期望 1）`);
      assert(
        Array.isArray(mixedData.invalid_rows) && mixedData.invalid_rows.length === 1,
        `dry_run invalid_rows 数量=${mixedData.invalid_rows?.length}（期望 1）`,
      );
      assert(
        mixedData.invalid_rows[0].index === 1,
        `invalid_rows[0].index=${mixedData.invalid_rows[0].index}（期望 1）`,
      );
      const drySearch = await httpJson(searchUrl(dryRunTitle), { headers: authHeaders });
      const dryWritten = (drySearch.json?.data?.items ?? []).some(
        (item) => item.title === dryRunTitle,
      );
      assert(!dryWritten, 'dry_run 后按标题检索到数据（不应写库）');

      // b) 单条有效 dry-run → commit → 检索确认 → 软删除。
      const rows = [
        {
          title: commitTitle,
          content: '由 pnpm smoke 通过 CSV 导入创建的测试反馈，验证后会软删除。',
          category: 'other',
          priority: 'medium',
        },
      ];
      const single = await httpJson(importUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ project_id: projectId, dry_run: true, rows }),
      });
      assert(
        single.status === 200 && single.json?.code === 0 && single.json?.data?.valid === 1,
        `单条 dry_run 未通过（HTTP ${single.status} code=${single.json?.code}）`,
      );

      const commit = await httpJson(importUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ project_id: projectId, dry_run: false, rows }),
      });
      assert(commit.status === 200, `commit HTTP ${commit.status}`);
      assert(commit.json?.code === 0, `commit code=${commit.json?.code}`);
      assert(commit.json?.data?.imported === 1, `imported=${commit.json?.data?.imported}（期望 1）`);

      const found = await httpJson(searchUrl(commitTitle), { headers: authHeaders });
      const target = (found.json?.data?.items ?? []).find(
        (item) => item.title === commitTitle,
      );
      assert(target?.id, 'commit 后未按标题检索到导入的反馈');
      importedId = target.id;

      const deleted = await httpJson(`${options.baseApi}/api/v1/admin/feedback/${importedId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(deleted.status === 200 && deleted.json?.code === 0, `软删除失败 HTTP ${deleted.status}`);
      importedId = null;

      const after = await httpJson(searchUrl(commitTitle), { headers: authHeaders });
      const stillExists = (after.json?.data?.items ?? []).some(
        (item) => item.title === commitTitle,
      );
      assert(!stillExists, '软删除后仍能检索到导入的反馈');

      // audit 子断言：接口支持 action 过滤时校验，不支持则跳过。
      let auditDetail = 'audit 过滤不可用，跳过';
      try {
        const audit = await httpJson(
          `${options.baseApi}/api/v1/org/audit-logs?action=feedback.import&page_size=10`,
          { headers: authHeaders },
        );
        if (audit.status === 200 && audit.json?.code === 0) {
          const hit = (audit.json.data?.items ?? []).find(
            (item) => item.action === 'feedback.import',
          );
          auditDetail = hit
            ? 'audit=feedback.import ✓'
            : 'audit 暂无 feedback.import（子断言跳过）';
        } else {
          auditDetail = `audit 过滤不支持（HTTP ${audit.status}），跳过`;
        }
      } catch {
        auditDetail = 'audit 请求失败，跳过';
      }

      return `dry_run valid=1/invalid index=1 不写库 · imported=1 · 检索+软删除 ✓ · ${auditDetail}`;
    } finally {
      if (importedId) {
        try {
          await httpJson(`${options.baseApi}/api/v1/admin/feedback/${importedId}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
        } catch {
          /* 尽力而为 */
        }
      }
      await deleteFeedbackByTitle(options, token, dryRunTitle).catch(() => {});
      await deleteFeedbackByTitle(options, token, commitTitle).catch(() => {});
    }
  });
}

async function checkI18nSwitch(page, options, context) {
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

async function checkMobile(page, options, context) {
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
    await checkI18nSwitch(page, options, context);
    await checkWriteFlows(page, options, context);
    await checkApiContract(options, context);
    await checkCsvImport(options, context);
    await checkMobile(page, options, context);
  } catch (error) {
    results.push({
      name: '环境初始化',
      status: 'FAIL',
      ms: 0,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // 最终兜底：恢复桌面视口与中文界面（9222 profile 是共享的，其他并行任务也可能改写，
    // 这里至少保证本脚本退出前把自己改动过的 state 复位）。
    if (page) {
      try {
        await Promise.race([
          page.setViewport({ width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 }),
          sleep(1000),
        ]);
      } catch {
        /* ignore */
      }
      try {
        await Promise.race([page.evaluate(`localStorage.setItem('lang', 'zh')`), sleep(1000)]);
      } catch {
        /* ignore */
      }
    }
    if (context.widgetProcess) {
      try {
        context.widgetProcess.kill();
      } catch {
        /* ignore */
      }
    }
    await chromeCommand.stop();
    if (page) await Promise.race([page.close().catch(() => {}), sleep(1500)]);
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
