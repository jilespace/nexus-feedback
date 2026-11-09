#!/usr/bin/env node
/**
 * Nexus Feedback 前端性能采样（零依赖：Node 24 内置 WebSocket + Chrome CDP）。
 *
 * 采集页面：看板首页 / 看板详情 / 提交页 / Landing / 登录页 / 登录后仪表盘。
 * 指标：FCP、LCP、CLS、DOMContentLoaded、Load、resource 数量与总传输大小。
 * 每页每视口采样 N 次取中位数，输出中文表格 + 阈值判定（FCP ≤1.8s、LCP ≤2.5s、CLS ≤0.1），
 * 同时写 .tools/perf/report-{timestamp}.json / .md（.tools 已 gitignore）。
 *
 * 前置：本地 dev server 已启动（admin 8080 / submit 8081 / board 8082 / api 3000），
 * Chrome 已在 9222 运行，或允许脚本自行启动 headless Chrome（结束时自动关闭并清理临时 profile）。
 *
 * 用法：
 *   pnpm perf
 *   node scripts/perf.mjs --runs=5 --settle=2000
 *   node scripts/perf.mjs --base-admin=http://localhost:8080 --chrome-port=9222
 *
 * 说明：测量对象是 Vite dev server（未压缩模块、按需编译），数值高于生产构建属预期，
 * 适合做页面间横向比较与回归趋势；阈值 PASS/FAIL 只做提示，不改变退出码。
 * 退出码：0 = 报告生成成功；1 = 环境/脚本错误（服务不可达、Chrome 启动失败等）。
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(ROOT, '.tools', 'perf');
const DEMO_PROJECT_SLUG = 'demo-project';
const DEMO_API_KEY = 'nf_demo_project_key_789';
const LOGIN = { email: 'admin@nexus.dev', password: 'admin123', org_slug: 'demo' };

const THRESHOLDS = { fcp: 1800, lcp: 2500, cls: 0.1 };

const VIEWPORTS = [
  { key: '1440', label: '1440×900', width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 },
  { key: '390', label: '390×844', width: 390, height: 844, mobile: true, deviceScaleFactor: 2 },
];

// 页面渲染就绪探针：用于记录页面是否真的渲染出来（不计入指标，仅用于问题线索）。
const READY_BOARD_HOME = `document.querySelectorAll('a[href*="/feedback/"]').length > 0`;
const READY_BOARD_DETAIL = `!!document.querySelector('article h1')`;
const READY_SUBMIT = `document.querySelectorAll('#feedback-form input, #feedback-form textarea').length > 0`;
const READY_LANDING = `!!document.querySelector('.lp-h1')`;
const READY_LOGIN = `!!document.querySelector('input[type="email"]')`;
const READY_DASHBOARD = `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`;

// 在文档脚本执行前安装 PerformanceObserver，保证能拿到完整的 LCP / CLS（含 buffered 条目）。
const PERF_PROBE_SCRIPT = `(() => {
  window.__perfProbe = { lcp: 0, lcpElement: null, cls: 0, clsSources: [] };
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (!last) return;
      window.__perfProbe.lcp = last.startTime;
      const el = last.element;
      window.__perfProbe.lcpElement = el
        ? el.tagName.toLowerCase()
          + (el.id ? '#' + el.id : '')
          + (typeof el.className === 'string' && el.className
            ? '.' + el.className.trim().split(/\\s+/)[0]
            : '')
        : null;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (error) { /* 旧版浏览器忽略 */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__perfProbe.cls += entry.value;
        const node = entry.sources && entry.sources[0] && entry.sources[0].node;
        if (node && entry.value > 0) {
          window.__perfProbe.clsSources.push({
            value: entry.value,
            node: node.tagName
              ? node.tagName.toLowerCase()
                + (node.id ? '#' + node.id : '')
                + (typeof node.className === 'string' && node.className
                  ? '.' + node.className.trim().split(/\\s+/)[0]
                  : '')
              : 'unknown',
          });
        }
      }
      window.__perfProbe.clsSources = window.__perfProbe.clsSources
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (error) { /* 旧版浏览器忽略 */ }
})();`;

const COLLECT_EXPR = `(() => {
  const probe = window.__perfProbe ?? {};
  const nav = performance.getEntriesByType('navigation')[0] ?? {};
  const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
  const resources = performance.getEntriesByType('resource').map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    transferSize: entry.transferSize || 0,
    decodedBodySize: entry.decodedBodySize || 0,
    duration: entry.duration || 0,
  }));
  return {
    url: location.href,
    title: document.title,
    httpStatus: typeof nav.responseStatus === 'number' ? nav.responseStatus : null,
    fcp: fcpEntry ? fcpEntry.startTime : null,
    lcp: typeof probe.lcp === 'number' ? probe.lcp : null,
    lcpElement: probe.lcpElement ?? null,
    cls: typeof probe.cls === 'number' ? probe.cls : null,
    clsSources: Array.isArray(probe.clsSources) ? probe.clsSources : [],
    ttfb: typeof nav.responseStart === 'number' ? nav.responseStart : null,
    dcl: nav.domContentLoadedEventEnd || null,
    load: nav.loadEventEnd || null,
    resourceCount: resources.length,
    transferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
    decodedBytes: resources.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
    topResources: resources
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 5)
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        duration: entry.duration,
      })),
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
    runs: 3,
    settleMs: 1500,
    help: false,
  };
  const keyMap = {
    'base-admin': 'baseAdmin',
    'base-board': 'baseBoard',
    'base-api': 'baseApi',
    'base-submit': 'baseSubmit',
    'chrome-port': 'chromePort',
    runs: 'runs',
    settle: 'settleMs',
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
    if (optionKey === 'chromePort' || optionKey === 'runs' || optionKey === 'settleMs') {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new Error(`--${match[1]} 需要数字`);
      options[optionKey] = numeric;
      continue;
    }
    options[optionKey] = value;
  }
  if (options.runs < 1) throw new Error('--runs 至少为 1');
  if (options.settleMs < 0) throw new Error('--settle 不能为负数');
  return options;
}

const USAGE = `Nexus Feedback 前端性能采样（CDP，零依赖）

用法:
  pnpm perf
  node scripts/perf.mjs [参数]

参数:
  --base-admin=<url>   管理后台地址（默认 http://localhost:8080）
  --base-board=<url>   公开看板地址（默认 http://localhost:8082）
  --base-api=<url>     API 地址（默认 http://localhost:3000）
  --base-submit=<url>  公开提交页地址（默认 http://localhost:8081）
  --chrome-port=<port> Chrome CDP 端口（默认 9222；缺失时自动启动 headless Chrome）
  --runs=<n>           每页每视口采样次数（默认 3，取中位数）
  --settle=<ms>        load 事件后额外等待时间，用于收敛 LCP/CLS（默认 1500）
  --help               显示本帮助

输出: 中文表格 + FCP/LCP/CLS 阈值判定；报告写入 .tools/perf/report-{timestamp}.json/.md。
阈值 FAIL 只做提示，不影响退出码；环境错误时退出码为 1。`;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
function truncate(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function displayWidth(text) {
  let width = 0;
  for (const char of String(text)) {
    width += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(char)
      ? 2
      : 1;
  }
  return width;
}

function padCell(text, width) {
  const value = truncate(String(text ?? ''), 240);
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
}

function formatMs(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}ms` : 'N/A';
}

function formatSecs(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value / 1000).toFixed(2)}s` : 'N/A';
}

function formatKB(bytes) {
  return typeof bytes === 'number' && Number.isFinite(bytes) ? `${(bytes / 1024).toFixed(1)}KB` : 'N/A';
}

function formatCls(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : 'N/A';
}

function shortResourceName(name) {
  try {
    const url = new URL(name);
    const file = url.pathname.split('/').filter(Boolean).pop() ?? url.pathname;
    return truncate(file, 48);
  } catch {
    return truncate(name, 48);
  }
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

function medianOf(values) {
  const numbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function stampFor(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

// ---------------------------------------------------------------------------
// Chrome / CDP
// ---------------------------------------------------------------------------
const chromeManager = {
  started: null,
  port: null,
  client: null,

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
        'Chrome 未在 9222 运行，且未找到 chrome 可执行文件；请先启动 Chrome 或设置 CHROME_PATH 环境变量',
      );
    }
    const profileDir = mkdtempSync(path.join(os.tmpdir(), 'nexus-perf-chrome-'));
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
    console.log(`Chrome 9222 未运行，已自动启动 headless Chrome（profile: ${profileDir}）`);
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
    if (existing) return { webSocketDebuggerUrl: existing, reused: true };
    return { webSocketDebuggerUrl: await this.start(port), reused: false };
  },

  async stop() {
    if (!this.started) return;
    const { child, profileDir } = this.started;
    const port = this.port;
    this.started = null;
    if (this.client) {
      try {
        await this.client.send('Browser.close');
      } catch {
        /* 浏览器关闭时连接会先断开，属于预期 */
      }
      this.client = null;
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

  close() {
    try {
      this.webSocket.close();
    } catch {
      /* ignore */
    }
  }
}

class PageSession {
  constructor(client) {
    this.client = client;
    this.sessionId = null;
    this.targetId = null;
  }

  async init({ browserContextId, viewport }) {
    const targetParams = { url: 'about:blank' };
    if (browserContextId) targetParams.browserContextId = browserContextId;
    const { targetId } = await this.client.send('Target.createTarget', targetParams);
    this.targetId = targetId;
    const { sessionId } = await this.client.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    this.sessionId = sessionId;

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Network.setCacheDisabled', { cacheDisabled: true });
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
      mobile: Boolean(viewport.mobile),
    });
    await this.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
  }

  send(method, params = {}) {
    return this.client.send(method, params, this.sessionId);
  }

  async addInitScript(source) {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  waitForLoad(timeoutMs = 30000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);
      const unsubscribe = this.client.on('Page.loadEventFired', (_params, sessionId) => {
        if (sessionId && sessionId !== this.sessionId) return;
        clearTimeout(timer);
        unsubscribe();
        resolve(true);
      });
    });
  }

  async navigate(url) {
    const loadEvent = this.waitForLoad();
    await this.send('Page.navigate', { url });
    return loadEvent;
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const description =
        result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        '页面脚本异常';
      throw new Error(String(description).slice(0, 400));
    }
    return result.result?.value ?? null;
  }

  async waitUntil(expression, { timeoutMs = 6000, intervalMs = 120 } = {}) {
    const deadline = Date.now() + timeoutMs;
    const probe = `(() => { try { return Boolean(${expression}); } catch (error) { return false; } })()`;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(probe)) return true;
      } catch {
        /* 导航期间上下文可能被销毁，继续轮询 */
      }
      await sleep(intervalMs);
    }
    return false;
  }

  async close() {
    try {
      if (this.targetId) await this.client.send('Target.closeTarget', { targetId: this.targetId });
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// 数据准备
// ---------------------------------------------------------------------------
async function loginDemo(options) {
  const response = await httpJson(`${options.baseApi}/api/v1/org/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });
  if (response.status !== 200 || response.json?.code !== 0) {
    throw new Error(
      `登录接口失败（HTTP ${response.status}）：${response.json?.message ?? response.text.slice(0, 120)}`,
    );
  }
  const data = response.json.data ?? {};
  if (!data.token || !data.member || !data.organization) {
    throw new Error('登录响应缺少 token / member / organization');
  }
  return data;
}

async function resolveBoardDetailUrl(options) {
  const listUrl = `${options.baseApi}/api/v1/public/${DEMO_PROJECT_SLUG}/feedback?page_size=1&sort_by=votes`;
  const response = await httpJson(listUrl);
  const id = response.json?.data?.items?.[0]?.id ?? null;
  if (!id) return null;
  return `${options.baseBoard}/${DEMO_PROJECT_SLUG}/feedback/${id}`;
}

function buildAdminInitScript(adminOrigin, auth) {
  const authBlock = auth
    ? `localStorage.setItem('admin_token', ${JSON.stringify(auth.token)});
      localStorage.setItem('org_member', ${JSON.stringify(JSON.stringify(auth.member))});
      localStorage.setItem('org_info', ${JSON.stringify(JSON.stringify(auth.organization))});`
    : '';
  return `(() => {
    try {
      if (location.origin !== ${JSON.stringify(adminOrigin)}) return;
      localStorage.setItem('theme', 'light');
      localStorage.setItem('lang', 'zh');
      ${authBlock}
    } catch (error) { /* localStorage 不可用时忽略 */ }
  })();`;
}

function buildPages(options, detailUrl) {
  return [
    { key: 'board-home', label: '看板首页', url: `${options.baseBoard}/${DEMO_PROJECT_SLUG}` },
    {
      key: 'board-detail',
      label: '看板详情',
      url: detailUrl,
      unavailableReason: detailUrl ? null : '未能从公开 API 取到 demo 反馈 ID',
    },
    { key: 'submit', label: '提交页', url: `${options.baseSubmit}/?key=${DEMO_API_KEY}` },
    { key: 'landing', label: 'Landing 首页', url: `${options.baseAdmin}/` },
    { key: 'login', label: '登录页（未登录）', url: `${options.baseAdmin}/dashboard` },
    {
      key: 'dashboard',
      label: '仪表盘（登录态）',
      url: `${options.baseAdmin}/dashboard`,
      auth: true,
      readyExpression: READY_DASHBOARD,
    },
  ].map((page) => ({
    ...page,
    readyExpression:
      page.readyExpression ??
      {
        'board-home': READY_BOARD_HOME,
        'board-detail': READY_BOARD_DETAIL,
        submit: READY_SUBMIT,
        landing: READY_LANDING,
        login: READY_LOGIN,
      }[page.key],
  }));
}

// ---------------------------------------------------------------------------
// 采样
// ---------------------------------------------------------------------------
async function measureOnce(client, contextId, viewport, page, initScript, settleMs) {
  const session = new PageSession(client);
  const record = {
    ok: false,
    ready: false,
    error: null,
    metrics: null,
  };
  try {
    await session.init({ browserContextId: contextId, viewport });
    if (initScript) await session.addInitScript(initScript);
    await session.addInitScript(PERF_PROBE_SCRIPT);
    const loaded = await session.navigate(page.url);
    if (!loaded) throw new Error('页面 load 事件超时（30s）');
    const ready = await session.waitUntil(page.readyExpression, { timeoutMs: 8000 });
    await sleep(settleMs);
    const metrics = await session.evaluate(COLLECT_EXPR);
    record.metrics = metrics;
    record.ok = true;
    if (ready) {
      record.ready = true;
    } else {
      try {
        record.ready = await session.evaluate(
          `(() => { try { return Boolean(${page.readyExpression}); } catch (error) { return false; } })()`,
        );
      } catch {
        record.ready = false;
      }
    }
  } catch (error) {
    record.error = error instanceof Error ? error.message : String(error);
  } finally {
    await session.close();
  }
  return record;
}

function summarizeSamples(samples) {
  const ok = samples.filter((sample) => sample.ok && sample.metrics);
  const metric = (key) => medianOf(ok.map((sample) => sample.metrics[key]));
  const representative = (() => {
    if (!ok.length) return null;
    const target = metric('lcp');
    return [...ok].sort(
      (a, b) => Math.abs((a.metrics.lcp ?? 0) - (target ?? 0)) - Math.abs((b.metrics.lcp ?? 0) - (target ?? 0)),
    )[0];
  })();

  return {
    samples,
    sampleCount: ok.length,
    failedSamples: samples.filter((sample) => !sample.ok),
    medians: {
      fcp: metric('fcp'),
      lcp: metric('lcp'),
      cls: metric('cls'),
      ttfb: metric('ttfb'),
      dcl: metric('dcl'),
      load: metric('load'),
      resourceCount: metric('resourceCount'),
      transferBytes: metric('transferBytes'),
      decodedBytes: metric('decodedBytes'),
    },
    ready: ok.length > 0 && ok.every((sample) => sample.ready),
    httpStatuses: ok.map((sample) => sample.metrics.httpStatus),
    topResources: representative?.metrics.topResources ?? [],
    clsSources: representative?.metrics.clsSources ?? [],
    lcpElement: representative?.metrics.lcpElement ?? null,
    title: representative?.metrics.title ?? null,
    representativeUrl: representative?.metrics.url ?? null,
  };
}

function evaluateThresholds(medians) {
  const judge = (value, limit) => ({
    value,
    limit,
    pass: typeof value === 'number' && Number.isFinite(value) && value <= limit,
  });
  const fcp = judge(medians.fcp, THRESHOLDS.fcp);
  const lcp = judge(medians.lcp, THRESHOLDS.lcp);
  const cls = judge(medians.cls, THRESHOLDS.cls);
  return { fcp, lcp, cls, pass: fcp.pass && lcp.pass && cls.pass };
}

async function samplePage(client, contextId, viewport, page, options, auth, adminOrigin) {
  const initScript = buildAdminInitScript(adminOrigin, page.auth ? auth : null);
  const samples = [];
  for (let index = 1; index <= options.runs; index += 1) {
    const startedAt = Date.now();
    const sample = await measureOnce(client, contextId, viewport, page, initScript, options.settleMs);
    samples.push({ index, durationMs: Date.now() - startedAt, ...sample });
    const metrics = sample.metrics;
    console.log(
      `  采样 ${page.label} ${viewport.label} #${index}：` +
        (metrics
          ? `FCP=${formatMs(metrics.fcp)} LCP=${formatMs(metrics.lcp)} CLS=${formatCls(metrics.cls)} ` +
            `DCL=${formatMs(metrics.dcl)} Load=${formatMs(metrics.load)} 资源=${metrics.resourceCount} 传输=${formatKB(metrics.transferBytes)}`
          : `失败：${sample.error}`),
    );
  }
  const summary = summarizeSamples(samples);
  return { ...summary, thresholds: evaluateThresholds(summary.medians) };
}

// ---------------------------------------------------------------------------
// 报告
// ---------------------------------------------------------------------------
function buildIssueClues(results) {
  const issues = [];
  for (const result of results) {
    const { page, viewport, thresholds, medians } = result;
    const label = `${page.label} ${viewport.label}`;
    const startLength = issues.length;
    if (!result.sampleCount) {
      issues.push(`${label}：所有采样失败（${result.failedSamples[0]?.error ?? '未知原因'}）`);
      continue;
    }
    if (!thresholds.fcp.pass) issues.push(`${label}：FCP ${formatSecs(medians.fcp)} 超过 1.8s 阈值`);
    if (!thresholds.lcp.pass) {
      issues.push(`${label}：LCP ${formatSecs(medians.lcp)} 超过 2.5s 阈值`);
    }
    const clsClue = result.clsSources.length
      ? `（主要位移：${result.clsSources.map((source) => `${source.node} ${source.value.toFixed(3)}`).join('、')}）`
      : '';
    if (!thresholds.cls.pass) {
      issues.push(`${label}：CLS ${formatCls(medians.cls)} 超过 0.1 阈值${clsClue}`);
    } else if (typeof medians.cls === 'number' && medians.cls >= THRESHOLDS.cls * 0.75) {
      issues.push(`${label}：CLS ${formatCls(medians.cls)} 接近 0.1 阈值（信息）${clsClue}`);
    }
    if (!result.ready) issues.push(`${label}：页面就绪探针未通过（可能未完整渲染）`);
    if (result.httpStatuses.some((status) => typeof status === 'number' && status >= 400)) {
      issues.push(`${label}：页面 HTTP 状态异常（${result.httpStatuses.filter((s) => s >= 400).join(', ')}）`);
    }
    if (issues.length === startLength) continue;
    if (result.topResources.length) {
      const top = result.topResources
        .slice(0, 3)
        .map((resource) => `${shortResourceName(resource.name)} ${formatKB(resource.transferSize)}/${formatMs(resource.duration)}`)
        .join('、');
      issues.push(`${label}：最大资源 ${top}`);
    }
    if (result.lcpElement) issues.push(`${label}：LCP 元素 ${result.lcpElement}`);
  }
  return issues;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push(`# Nexus Feedback 前端性能报告`);
  lines.push('');
  lines.push(`- 生成时间：${report.generatedAt}`);
  lines.push(`- Chrome：CDP ${report.environment.chromePort}（${report.environment.chromeReused ? '复用已运行实例' : '脚本自动启动 headless'}）`);
  lines.push(`- 采样：每页每视口 ${report.environment.runs} 次取中位数；` +
    `load 后额外等待 ${report.environment.settleMs}ms；缓存已禁用（Network.setCacheDisabled）`);
  lines.push(`- 地址：admin ${report.environment.baseAdmin} / board ${report.environment.baseBoard} / submit ${report.environment.baseSubmit} / api ${report.environment.baseApi}`);
  lines.push(`- 阈值：FCP ≤ ${THRESHOLDS.fcp}ms，LCP ≤ ${THRESHOLDS.lcp}ms，CLS ≤ ${THRESHOLDS.cls}`);
  lines.push('');
  lines.push('> 说明：测量对象为本地 Vite dev server（未压缩、按需编译），数值会高于生产构建，');
  lines.push('> 适合页面间横向比较与回归趋势；阈值 PASS/FAIL 仅提示，脚本退出码不受影响。');
  lines.push('');
  lines.push('## 结果（中位数）');
  lines.push('');
  lines.push('| 页面 | 视口 | FCP | LCP | CLS | DCL | Load | TTFB | 资源数 | 传输大小 | 判定 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const result of report.results) {
    if (!result.sampleCount) {
      lines.push(`| ${result.page.label} | ${result.viewport.label} | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ❌ 全部失败 |`);
      continue;
    }
    const verdictParts = [];
    if (!result.thresholds.fcp.pass) verdictParts.push('FCP');
    if (!result.thresholds.lcp.pass) verdictParts.push('LCP');
    if (!result.thresholds.cls.pass) verdictParts.push('CLS');
    const verdict = result.thresholds.pass ? '✅ PASS' : `❌ FAIL（${verdictParts.join('/')}）`;
    lines.push(
      `| ${result.page.label} | ${result.viewport.label} | ${formatMs(result.medians.fcp)} | ` +
        `${formatMs(result.medians.lcp)} | ${formatCls(result.medians.cls)} | ` +
        `${formatMs(result.medians.dcl)} | ${formatMs(result.medians.load)} | ` +
        `${formatMs(result.medians.ttfb)} | ${result.medians.resourceCount ?? 'N/A'} | ` +
        `${formatKB(result.medians.transferBytes)} | ${verdict} |`,
    );
  }
  lines.push('');
  const passCount = report.results.filter((result) => result.thresholds?.pass).length;
  lines.push(`**结论：${passCount}/${report.results.length} 个「页面 × 视口」组合通过全部阈值。**`);
  lines.push('');
  lines.push('## 问题线索');
  lines.push('');
  if (report.issues.length) {
    for (const issue of report.issues) lines.push(`- ${issue}`);
  } else {
    lines.push('- 未发现阈值超限或页面就绪问题。');
  }
  lines.push('');
  lines.push('## 资源明细（每组合 LCP 中位数样本的 Top 资源）');
  lines.push('');
  for (const result of report.results) {
    if (!result.topResources.length) continue;
    lines.push(`### ${result.page.label} · ${result.viewport.label}`);
    lines.push('');
    lines.push('| 资源 | 类型 | 传输 | 耗时 |');
    lines.push('|---|---|---|---|');
    for (const resource of result.topResources) {
      lines.push(`| ${shortResourceName(resource.name)} | ${resource.initiatorType} | ${formatKB(resource.transferSize)} | ${formatMs(resource.duration)} |`);
    }
    lines.push('');
    if (result.lcpElement) lines.push(`LCP 元素：\`${result.lcpElement}\`；页面标题：${result.title ?? 'N/A'}`);
    lines.push('');
  }
  lines.push('## 原始采样');
  lines.push('');
  lines.push('每次采样的完整指标与资源明细见同名 `.json` 文件（`results[].samples`）。');
  lines.push('');
  return lines.join('\n');
}

function printConsoleTable(report) {
  const headers = ['页面', '视口', 'FCP', 'LCP', 'CLS', 'DCL', 'Load', '资源', '传输', '判定'];
  const widths = [18, 9, 8, 8, 6, 8, 8, 6, 9, 14];
  const rows = report.results.map((result) => {
    if (!result.sampleCount) {
      return ['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'FAIL（全部失败）'].map((cell, index) =>
        padCell(cell, widths[index]),
      );
    }
    const failed = [];
    if (!result.thresholds.fcp.pass) failed.push('FCP');
    if (!result.thresholds.lcp.pass) failed.push('LCP');
    if (!result.thresholds.cls.pass) failed.push('CLS');
    return [
      result.page.label,
      result.viewport.label,
      formatMs(result.medians.fcp),
      formatMs(result.medians.lcp),
      formatCls(result.medians.cls),
      formatMs(result.medians.dcl),
      formatMs(result.medians.load),
      String(result.medians.resourceCount ?? 'N/A'),
      formatKB(result.medians.transferBytes),
      result.thresholds.pass ? 'PASS' : `FAIL（${failed.join(',')}）`,
    ].map((cell, index) => padCell(cell, widths[index]));
  });

  console.log('');
  console.log(headers.map((header, index) => padCell(header, widths[index])).join(''));
  console.log(widths.map((width) => '-'.repeat(width)).join(''));
  for (const row of rows) console.log(row.join(''));
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

  const startedAt = new Date();
  console.log('Nexus Feedback 前端性能采样（CDP）');
  console.log(
    `admin=${options.baseAdmin}  board=${options.baseBoard}  submit=${options.baseSubmit}  api=${options.baseApi}`,
  );
  console.log(
    `视口：${VIEWPORTS.map((viewport) => viewport.label).join(' / ')}；每组合采样 ${options.runs} 次取中位数；` +
      `阈值 FCP≤${THRESHOLDS.fcp}ms / LCP≤${THRESHOLDS.lcp}ms / CLS≤${THRESHOLDS.cls}`,
  );

  const adminOrigin = new URL(options.baseAdmin).origin;
  let client = null;
  let auth = null;
  let chromeReused = false;
  const results = [];
  const browserContexts = [];

  try {
    const { webSocketDebuggerUrl, reused } = await chromeManager.ensure(options.chromePort);
    chromeReused = reused;
    client = await CdpClient.connect(webSocketDebuggerUrl);
    chromeManager.client = client;

    console.log(`Chrome ${reused ? '复用已有实例' : '已自动启动'}（CDP 端口 ${options.chromePort}）`);

    auth = await loginDemo(options);
    console.log(`登录态注入准备完成：${auth.member.display_name ?? auth.member.email}（${auth.member.role}）`);

    const detailUrl = await resolveBoardDetailUrl(options);
    console.log(detailUrl ? `看板详情 URL：${detailUrl}` : '⚠️ 未能获取 demo 反馈详情 ID，跳过看板详情采样');

    const pages = buildPages(options, detailUrl);

    for (const viewport of VIEWPORTS) {
      for (const page of pages) {
        if (page.unavailableReason) {
          console.log(`跳过采样：${page.label}（${page.unavailableReason}）`);
          results.push({
            page: { key: page.key, label: page.label, url: page.url ?? '' },
            viewport,
            samples: [],
            sampleCount: 0,
            failedSamples: [{ error: page.unavailableReason }],
            medians: {},
            thresholds: { fcp: { pass: false }, lcp: { pass: false }, cls: { pass: false }, pass: false },
            topResources: [],
            ready: false,
            httpStatuses: [],
          });
          continue;
        }
        const { browserContextId } = await client.send('Target.createBrowserContext', {});
        browserContexts.push(browserContextId);
        console.log(`\n▶ ${page.label} · ${viewport.label}`);
        const result = await samplePage(client, browserContextId, viewport, page, options, auth, adminOrigin);
        results.push({
          page: { key: page.key, label: page.label, url: page.url },
          viewport,
          ...result,
        });
        await client.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
        browserContexts.pop();
      }
    }

    const issues = buildIssueClues(results);
    const report = {
      generatedAt: startedAt.toISOString(),
      environment: {
        chromePort: options.chromePort,
        chromeReused,
        runs: options.runs,
        settleMs: options.settleMs,
        cacheDisabled: true,
        baseAdmin: options.baseAdmin,
        baseBoard: options.baseBoard,
        baseSubmit: options.baseSubmit,
        baseApi: options.baseApi,
        viewports: VIEWPORTS.map((viewport) => ({ key: viewport.key, label: viewport.label })),
        thresholds: THRESHOLDS,
        devServerNote:
          '测量对象为 Vite dev server（未压缩模块、按需编译），数值高于生产构建属预期，适合横向比较与回归。',
      },
      results,
      issues,
    };

    mkdirSync(REPORT_DIR, { recursive: true });
    const stamp = stampFor(startedAt);
    const jsonPath = path.join(REPORT_DIR, `report-${stamp}.json`);
    const mdPath = path.join(REPORT_DIR, `report-${stamp}.md`);
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    writeFileSync(mdPath, buildMarkdown(report), 'utf8');

    printConsoleTable(report);
    const passCount = results.filter((result) => result.thresholds?.pass).length;
    console.log('');
    console.log(`合计：${passCount}/${results.length} 个「页面 × 视口」组合 PASS`);
    if (issues.length) {
      console.log('问题线索：');
      for (const issue of issues) console.log(`  - ${issue}`);
    }
    console.log('');
    console.log(`JSON 报告：${path.relative(ROOT, jsonPath)}`);
    console.log(`Markdown 报告：${path.relative(ROOT, mdPath)}`);

    // 恢复共享 9222 实例的中文界面（避免影响其他并行任务）。
    if (chromeReused) {
      try {
        const cleanup = await client.send('Target.createTarget', { url: `${options.baseAdmin}/` });
        const attached = await client.send('Target.attachToTarget', {
          targetId: cleanup.targetId,
          flatten: true,
        });
        await client.send(
          'Runtime.evaluate',
          { expression: `localStorage.setItem('lang', 'zh')`, returnByValue: true },
          attached.sessionId,
        );
        await client.send('Target.closeTarget', { targetId: cleanup.targetId });
      } catch {
        /* ignore */
      }
    }

    return 0;
  } catch (error) {
    console.error('性能采样失败:', error instanceof Error ? error.message : error);
    return 1;
  } finally {
    for (const browserContextId of browserContexts) {
      try {
        await client?.send('Target.disposeBrowserContext', { browserContextId });
      } catch {
        /* ignore */
      }
    }
    await chromeManager.stop();
    client?.close();
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error('性能脚本崩溃:', error);
    process.exitCode = 1;
  });

// 兜底：异常退出时也尽量回收本脚本启动的 headless Chrome。
process.on('exit', () => {
  const started = chromeManager.started;
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
