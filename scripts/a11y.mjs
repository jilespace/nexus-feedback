#!/usr/bin/env node
/**
 * Nexus Feedback 无障碍（a11y）审计（零依赖：Node 24 内置 WebSocket + Chrome CDP）。
 *
 * 覆盖页面：提交页、board 首页/详情、admin 登录页 + 登录后 dashboard/feedback/notifications。
 * 检查项（DOM 级近似审计，桌面 1440×900）：
 *  - 可聚焦元素顺序 / 正 tabindex 滥用 / 键盘 Tab 焦点可见性（对比聚焦前后 outline/box-shadow）
 *  - 交互元素可访问名称（a/button/input/select/textarea/[role=…]）
 *  - 图片 alt / 图标按钮 aria-label / html lang / 标题层级（h1 唯一、不跳级）
 *  - 表单 label 关联、aria-* 合法性与引用完整性、aria-hidden 焦点陷阱
 *  - 颜色对比度近似（computed color vs 祖先背景，AA 4.5:1；大字 3:1）
 *
 * 用法：pnpm a11y / node scripts/a11y.mjs [--base-admin=...] [--chrome-port=9222]
 * 输出：终端中文表格 + .tools/a11y/report-{timestamp}.json/.md（.tools 已 gitignore）。
 * 退出码：0 = 报告生成成功（发现问题不影响退出码）；1 = 环境/脚本错误。
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(ROOT, '.tools', 'a11y');
const DEMO_PROJECT_SLUG = 'demo-project';
const DEMO_API_KEY = 'nf_demo_project_key_789';
const LOGIN = { email: 'admin@nexus.dev', password: 'admin123', org_slug: 'demo' };
const VIEWPORT = { width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 };
const MAX_TAB_STEPS = 90;

const SEVERITIES = ['serious', 'moderate', 'minor'];
const SEVERITY_LABELS = { serious: '严重', moderate: '中等', minor: '轻微' };
const CATEGORY_LABELS = {
  document: '文档',
  headings: '标题结构',
  images: '图片',
  names: '可访问名称',
  labels: '表单标签',
  aria: 'ARIA',
  focus: '焦点',
  contrast: '颜色对比度',
  other: '其他',
};

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
    only: '',
    help: false,
  };
  const keyMap = {
    'base-admin': 'baseAdmin',
    'base-board': 'baseBoard',
    'base-api': 'baseApi',
    'base-submit': 'baseSubmit',
    'chrome-port': 'chromePort',
    only: 'only',
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

const USAGE = `Nexus Feedback 无障碍审计（CDP，零依赖）

用法:
  pnpm a11y
  node scripts/a11y.mjs [参数]

参数:
  --base-admin=<url>   管理后台地址（默认 http://localhost:8080）
  --base-board=<url>   公开看板地址（默认 http://localhost:8082）
  --base-api=<url>     API 地址（默认 http://localhost:3000）
  --base-submit=<url>  公开提交页地址（默认 http://localhost:8081）
  --chrome-port=<port> Chrome CDP 端口（默认 9222；缺失时自动启动 headless Chrome）
  --only=<keys>        只审计指定页面（逗号分隔：submit,board-home,board-detail,admin-login,admin-dashboard,admin-feedback,admin-notifications）
  --help               显示本帮助

覆盖：提交页、board 首页/详情、admin 登录页 + dashboard/feedback/notifications（登录态注入）。
输出：终端中文表格 + .tools/a11y/report-{timestamp}.json/.md。
发现 a11y 问题只做报告、不影响退出码；环境错误时退出码为 1。`;

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
  const value = truncate(String(text ?? ''), 200);
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
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
      throw new Error('Chrome 未在 9222 运行，且未找到 chrome 可执行文件；请先启动 Chrome 或设置 CHROME_PATH');
    }
    const profileDir = mkdtempSync(path.join(os.tmpdir(), 'nexus-a11y-chrome-'));
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
      /* ignore */
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
      throw new Error(String(description).slice(0, 500));
    }
    return result.result?.value ?? null;
  }

  async waitUntil(expression, { timeoutMs = 8000, intervalMs = 120 } = {}) {
    const deadline = Date.now() + timeoutMs;
    const probe = `(() => { try { return Boolean(${expression}); } catch (error) { return false; } })()`;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(probe)) return true;
      } catch {
        /* ignore */
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
// 页面内审计函数（序列化后注入页面执行；保持自包含）
// ---------------------------------------------------------------------------
function pageAudit() {
  const violations = [];
  const ARIA_ROLES = new Set([
    'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox',
    'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'directory',
    'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'link',
    'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
    'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar',
    'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
    'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid',
    'treeitem',
  ]);
  const ARIA_ATTRS = new Set([
    'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-braillelabel',
    'aria-brailleroledescription', 'aria-busy', 'aria-checked', 'aria-colcount', 'aria-colindex',
    'aria-colindextext', 'aria-colspan', 'aria-controls', 'aria-current', 'aria-describedby',
    'aria-description', 'aria-details', 'aria-disabled', 'aria-dropeffect', 'aria-errormessage',
    'aria-expanded', 'aria-flowto', 'aria-grabbed', 'aria-haspopup', 'aria-hidden', 'aria-invalid',
    'aria-keyshortcuts', 'aria-label', 'aria-labelledby', 'aria-level', 'aria-live', 'aria-modal',
    'aria-multiline', 'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder',
    'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant', 'aria-required',
    'aria-roledescription', 'aria-rowcount', 'aria-rowindex', 'aria-rowindextext', 'aria-rowspan',
    'aria-selected', 'aria-setsize', 'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow',
    'aria-valuetext',
  ]);
  const BOOLEAN_ARIA = new Set([
    'aria-atomic', 'aria-busy', 'aria-disabled', 'aria-expanded', 'aria-hidden', 'aria-modal',
    'aria-multiline', 'aria-multiselectable', 'aria-readonly', 'aria-required', 'aria-selected',
  ]);
  const TRI_ARIA = new Set(['aria-checked', 'aria-pressed', 'aria-current', 'aria-haspopup']);
  const REF_ARIA = new Set([
    'aria-activedescendant', 'aria-controls', 'aria-describedby', 'aria-details',
    'aria-errormessage', 'aria-flowto', 'aria-labelledby', 'aria-owns',
  ]);

  function push(severity, category, message, el, extra) {
    violations.push({
      severity,
      category,
      message,
      selector: el ? selectorOf(el) : '',
      snippet: el ? (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) : '',
      ...(extra ? { extra } : {}),
    });
  }

  function selectorOf(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + el.id;
    const parts = [];
    let current = el;
    let depth = 0;
    while (current && current.nodeType === 1 && depth < 3) {
      const tag = current.tagName.toLowerCase();
      const classes = (typeof current.className === 'string' ? current.className : '')
        .split(/\s+/)
        .filter((name) => name && name.indexOf(':') < 0)
        .slice(0, 2);
      let part = tag + (classes.length ? '.' + classes.join('.') : '');
      const parent = current.parentElement;
      if (parent) {
        const sameTag = Array.prototype.filter.call(parent.children, (child) => child.tagName === current.tagName);
        if (sameTag.length > 1) {
          part += ':nth-of-type(' + (sameTag.indexOf(current) + 1) + ')';
        }
      }
      parts.unshift(part);
      if (current.id || depth >= 2) break;
      current = parent;
      depth += 1;
    }
    return parts.join(' > ');
  }

  function styleOf(el) {
    try {
      return window.getComputedStyle(el);
    } catch (error) {
      return null;
    }
  }

  function isRendered(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const style = styleOf(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (Number(style.opacity) === 0) return false;
    return el.getClientRects().length > 0;
  }

  function isDisabled(el) {
    return Boolean(el.closest('[disabled], [aria-disabled="true"]'));
  }

  function accName(el) {
    const labelledby = el.getAttribute && el.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (text) return text;
    }
    const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    if (el.labels && el.labels.length) {
      const text = Array.prototype.map
        .call(el.labels, (label) => (label.textContent || '').trim())
        .filter(Boolean)
        .join(' ');
      if (text) return text;
    }
    if (el.tagName === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      if ((type === 'submit' || type === 'button' || type === 'reset') && el.value) return el.value;
      if (type === 'image' && el.alt) return el.alt;
    }
    if (el.tagName === 'IMG' && el.alt) return el.alt;
    const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text) return text;
    const title = el.getAttribute && el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    return '';
  }

  function parseColor(value) {
    const match = String(value || '').match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map((part) => Number(part.trim()));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  function blend(fg, bg) {
    const alpha = fg.a;
    return {
      r: fg.r * alpha + bg.r * (1 - alpha),
      g: fg.g * alpha + bg.g * (1 - alpha),
      b: fg.b * alpha + bg.b * (1 - alpha),
      a: 1,
    };
  }

  function luminance(color) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  function contrastRatio(fg, bg) {
    const first = luminance(fg);
    const second = luminance(bg);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function effectiveBackground(el) {
    const chain = [];
    let current = el;
    while (current && current.nodeType === 1) {
      chain.unshift(current);
      current = current.parentElement;
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const node of chain) {
      const style = styleOf(node);
      if (!style) continue;
      // 渐变/背景图无法可靠还原，标记为未知，避免误报
      if (style.backgroundImage && style.backgroundImage !== 'none') return { unknown: true };
      const color = parseColor(style.backgroundColor);
      if (color && color.a > 0) bg = blend(color, bg);
    }
    return bg;
  }

  // ---- 文档级 ----
  const lang = (document.documentElement.getAttribute('lang') || '').trim();
  if (!lang) push('serious', 'document', '缺少 <html lang>，屏幕阅读器无法确定页面语言', document.documentElement);
  else if (!/^[a-z]{2,3}(-[a-zA-Z0-9]+)*$/.test(lang)) {
    push('moderate', 'document', `html lang 值可能不合法：${lang}`, document.documentElement);
  }
  if (!document.title || !document.title.trim()) {
    push('serious', 'document', '页面缺少 <title>', document.documentElement);
  }

  // ---- 标题层级 ----
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(isRendered);
  const h1s = headings.filter((heading) => heading.tagName === 'H1');
  if (h1s.length === 0) push('moderate', 'headings', '页面没有 h1 标题', document.body);
  if (h1s.length > 1) push('moderate', 'headings', `页面存在 ${h1s.length} 个 h1`, h1s[1]);
  let previousLevel = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1));
    if (previousLevel && level - previousLevel > 1) {
      push('moderate', 'headings', `标题层级跳级：h${previousLevel} → h${level}`, heading);
      break;
    }
    previousLevel = level;
  }

  // ---- 图片 ----
  for (const img of Array.from(document.querySelectorAll('img')).filter(isRendered)) {
    if (!img.hasAttribute('alt')) push('serious', 'images', '图片缺少 alt 属性', img);
  }
  for (const svg of Array.from(document.querySelectorAll('svg[role="img"]'))) {
    if (isRendered(svg) && !accName(svg)) push('moderate', 'images', 'role="img" 的 SVG 缺少可访问名称', svg);
  }

  // ---- 可访问名称 ----
  const NAME_SELECTORS = [
    'a[href]', 'button', 'select', 'textarea', 'summary',
    'input:not([type="hidden"])',
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="checkbox"]', '[role="radio"]',
    '[role="switch"]', '[role="menuitem"]', '[role="option"]', '[role="combobox"]',
    '[contenteditable="true"]',
  ];
  const nameNodes = Array.from(new Set(document.querySelectorAll(NAME_SELECTORS.join(',')))).filter(
    (el) => isRendered(el),
  );
  for (const el of nameNodes) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' && (el.type === 'hidden' || el.type === 'file')) continue;
    if (!accName(el)) {
      push('serious', 'names', '交互元素缺少可访问名称（文本 / aria-label / label）', el);
    }
  }

  // ---- 表单标签 ----
  for (const el of Array.from(document.querySelectorAll('input,select,textarea')).filter(isRendered)) {
    const type = (el.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    const hasLabel = (el.labels && el.labels.length > 0) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    if (!hasLabel) {
      const title = el.getAttribute('title');
      push(
        title ? 'moderate' : 'serious',
        'labels',
        title ? '表单控件只有 title，缺少 label 关联' : '表单控件缺少 label / aria-label 关联',
        el,
      );
    }
    if (el.getAttribute('aria-describedby')) {
      for (const id of el.getAttribute('aria-describedby').split(/\s+/)) {
        if (id && !document.getElementById(id)) {
          push('moderate', 'aria', `aria-describedby 引用了不存在的 id：${id}`, el);
        }
      }
    }
  }

  // ---- ARIA 合法性与引用 ----
  const ariaNodes = Array.from(document.querySelectorAll('*')).filter((el) => {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('aria-') || attr.name === 'role') return true;
    }
    return false;
  });
  for (const el of ariaNodes) {
    const role = el.getAttribute('role');
    if (role) {
      for (const token of role.split(/\s+/).filter(Boolean)) {
        if (!ARIA_ROLES.has(token)) push('moderate', 'aria', `未知的 role：${token}`, el);
      }
    }
    for (const attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith('aria-')) continue;
      if (!ARIA_ATTRS.has(attr.name)) {
        push('moderate', 'aria', `未知的 ARIA 属性：${attr.name}`, el);
        continue;
      }
      const value = attr.value.trim();
      if (BOOLEAN_ARIA.has(attr.name) && value !== 'true' && value !== 'false') {
        push('moderate', 'aria', `${attr.name} 应为 "true"/"false"，当前为 "${value}"`, el);
      }
      if (attr.name === 'aria-live' && !['off', 'polite', 'assertive'].includes(value)) {
        push('moderate', 'aria', `aria-live 值不合法：${value}`, el);
      }
      if (attr.name === 'aria-invalid' && !['true', 'false', 'grammar', 'spelling'].includes(value)) {
        push('moderate', 'aria', `aria-invalid 值不合法：${value}`, el);
      }
      if (TRI_ARIA.has(attr.name) && !['true', 'false', 'mixed', 'undefined', 'page', 'step', 'location', 'date', 'time', 'true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog', 'false'].includes(value)) {
        push('moderate', 'aria', `${attr.name} 值可疑：${value}`, el);
      }
      if (REF_ARIA.has(attr.name)) {
        for (const id of value.split(/\s+/)) {
          if (id && !document.getElementById(id)) push('moderate', 'aria', `${attr.name} 引用了不存在的 id：${id}`, el);
        }
      }
    }
    // aria-hidden 焦点陷阱
    if (el.getAttribute('aria-hidden') === 'true') {
      const focusable = Array.from(el.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')).filter(
        (node) => node.tabIndex >= 0 && !node.closest('[disabled]'),
      );
      if (focusable.length > 0) {
        push('serious', 'aria', `aria-hidden 容器内包含 ${focusable.length} 个可聚焦元素`, el);
      }
    }
    // 常见 role 的必填 aria 属性
    if (role === 'checkbox' || role === 'switch' || role === 'radio') {
      if (!el.hasAttribute('aria-checked')) push('moderate', 'aria', `role="${role}" 缺少 aria-checked`, el);
    }
    if (role === 'dialog' && !accName(el)) push('moderate', 'aria', 'role="dialog" 缺少可访问名称', el);
  }

  // ---- 焦点：正 tabindex / 隐藏可聚焦 ----
  const focusableAll = Array.from(
    document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]'),
  );
  const positiveTabindex = focusableAll.filter((el) => Number(el.getAttribute('tabindex')) > 0);
  if (positiveTabindex.length) {
    push('moderate', 'focus', `存在 ${positiveTabindex.length} 个正 tabindex 元素，会打乱自然焦点顺序`, positiveTabindex[0]);
  }

  // 生成键盘顺序预期列表（正 tabindex 优先，radio 只取选中项）
  const tabbables = focusableAll.filter((el) => {
    if (el.tabIndex < 0) return false;
    if (el.matches('[disabled], [aria-disabled="true"]')) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.tagName === 'INPUT' && el.type === 'radio' && !el.checked) return false;
    // 排除被祖先 display:none 隐藏的元素（getClientRects 为空）
    return isRendered(el);
  });
  const expected = tabbables
    .map((el, index) => ({ el, index, pos: Number(el.getAttribute('tabindex')) || 0 }))
    .sort((a, b) => (a.pos === b.pos ? a.index - b.index : a.pos - b.pos));

  window.__a11y = {
    expected: expected.map((item) => item.index),
    base: {},
  };
  expected.forEach((item) => {
    item.el.setAttribute('data-a11y-focus-idx', String(item.index));
    const style = styleOf(item.el);
    window.__a11y.base[String(item.index)] = {
      outline: style ? `${style.outlineStyle}|${style.outlineWidth}|${style.outlineColor}` : '',
      boxShadow: style ? style.boxShadow : '',
    };
  });

  // ---- 颜色对比度 ----
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'PATH', 'TITLE']);
  const contrastViolations = [];
  let contrastChecked = 0;
  let contrastSkipped = 0;
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    if (!isRendered(el) || isDisabled(el) || el.closest('[aria-hidden="true"]')) continue;
    const rect = el.getBoundingClientRect();
    // 纯视觉隐藏（sr-only）的文字不参与对比度检查
    if (rect.width <= 2 && rect.height <= 2) continue;
    const directText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === 3 && node.nodeValue.trim())
      .map((node) => node.nodeValue.trim())
      .join(' ');
    if (!directText) continue;
    const style = styleOf(el);
    if (!style) continue;
    const fgRaw = parseColor(style.color);
    if (!fgRaw || fgRaw.a === 0) continue;
    const bg = effectiveBackground(el);
    if (bg.unknown) {
      contrastSkipped += 1;
      continue;
    }
    const fg = blend(fgRaw, bg);
    contrastChecked += 1;
    let ratio;
    try {
      ratio = contrastRatio(fg, bg);
    } catch (error) {
      continue;
    }
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const fontWeight = Number(style.fontWeight) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const required = isLarge ? 3 : 4.5;
    if (ratio < required) {
      const severity = ratio < 3 ? 'serious' : 'moderate';
      contrastViolations.push({
        severity,
        category: 'contrast',
        message: `文字对比度 ${ratio.toFixed(2)}:1（要求 ≥ ${required}:1${isLarge ? '，大字' : ''}）`,
        selector: selectorOf(el),
        snippet: directText.slice(0, 80),
        extra: {
          ratio: Number(ratio.toFixed(2)),
          required,
          color: style.color,
          background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
          fontSize,
          fontWeight,
        },
      });
    }
  }
  contrastViolations.sort((a, b) => a.extra.ratio - b.extra.ratio);
  for (const violation of contrastViolations.slice(0, 40)) violations.push(violation);
  const contrastTotal = contrastViolations.length;

  // ---- 重复 id ----
  const idCounts = new Map();
  for (const el of Array.from(document.querySelectorAll('[id]'))) {
    idCounts.set(el.id, (idCounts.get(el.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) push('minor', 'other', `重复 id：${id}（${count} 次）`, document.getElementById(id));
  }

  return {
    url: location.href,
    title: document.title,
    lang,
    headings: headings.map((heading) => heading.tagName.toLowerCase()),
    stats: {
      violations: violations.length,
      contrastChecked,
      contrastSkipped,
      contrastViolations: contrastTotal,
      nameNodes: nameNodes.length,
      focusableCount: expected.length,
      images: document.querySelectorAll('img').length,
    },
    violations: violations.slice(0, 300),
    truncated: violations.length > 300,
    focusOrder: expected.map((item) => item.index),
    focusables: expected.map((item) => ({
      index: item.index,
      tag: item.el.tagName.toLowerCase(),
      name: accName(item.el).slice(0, 60),
      selector: selectorOf(item.el),
    })),
  };
}

function resetFocusScript() {
  return `(() => {
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      window.scrollTo(0, 0);
    } catch (error) { /* ignore */ }
    return true;
  })()`;
}

function collectFocusState() {
  const active = document.activeElement;
  if (!active) return { kind: 'none' };
  const idx = active.getAttribute && active.getAttribute('data-a11y-focus-idx');
  if (idx === null || idx === undefined) {
    return {
      kind: 'outside',
      tag: active.tagName.toLowerCase(),
      text: (active.innerText || active.textContent || '').trim().slice(0, 60),
    };
  }
  const style = window.getComputedStyle(active);
  const base = (window.__a11y && window.__a11y.base && window.__a11y.base[String(idx)]) || null;
  const outline = `${style.outlineStyle}|${style.outlineWidth}|${style.outlineColor}`;
  const boxShadow = style.boxShadow;
  const visibleFocus = base ? outline !== base.outline || boxShadow !== base.boxShadow : true;
  return {
    kind: 'inside',
    index: Number(idx),
    tag: active.tagName.toLowerCase(),
    name: (active.getAttribute('aria-label') || active.innerText || active.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
    visibleFocus,
    outline,
    boxShadow,
  };
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

const ADMIN_READY = `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`;

function buildPages(options, detailUrl) {
  return [
    {
      key: 'submit',
      label: '提交页',
      url: `${options.baseSubmit}/?key=${DEMO_API_KEY}`,
      ready: `document.querySelectorAll('#feedback-form input, #feedback-form textarea').length > 0`,
    },
    {
      key: 'board-home',
      label: 'board 首页',
      url: `${options.baseBoard}/${DEMO_PROJECT_SLUG}`,
      ready: `document.querySelectorAll('a[href*="/feedback/"]').length > 0`,
    },
    {
      key: 'board-detail',
      label: 'board 详情',
      url: detailUrl,
      ready: `!!document.querySelector('article h1')`,
      unavailableReason: detailUrl ? null : '未能从公开 API 取到 demo 反馈 ID',
    },
    {
      key: 'admin-login',
      label: 'admin 登录页',
      url: `${options.baseAdmin}/dashboard`,
      ready: `!!document.querySelector('input[type="email"]')`,
    },
    {
      key: 'admin-dashboard',
      label: 'dashboard（登录态）',
      url: `${options.baseAdmin}/dashboard`,
      auth: true,
      ready: ADMIN_READY,
    },
    {
      key: 'admin-feedback',
      label: 'feedback（登录态）',
      url: `${options.baseAdmin}/feedback`,
      auth: true,
      ready: ADMIN_READY,
    },
    {
      key: 'admin-notifications',
      label: 'notifications（登录态）',
      url: `${options.baseAdmin}/notifications`,
      auth: true,
      ready: ADMIN_READY,
    },
  ];
}

// ---------------------------------------------------------------------------
// 审计执行
// ---------------------------------------------------------------------------
async function auditPage(client, browserContextId, page, options, auth, adminOrigin) {
  const session = new PageSession(client);
  const result = {
    page: { key: page.key, label: page.label, url: page.url ?? '' },
    ok: false,
    error: null,
    audit: null,
    focus: null,
  };
  try {
    await session.init({ browserContextId, viewport: VIEWPORT });
    await session.addInitScript(buildAdminInitScript(adminOrigin, page.auth ? auth : null));
    const loaded = await session.navigate(page.url);
    if (!loaded) throw new Error('页面 load 事件超时（30s）');
    const ready = await session.waitUntil(page.ready, { timeoutMs: 10000 });
    await sleep(1200);
    result.audit = await session.evaluate(`(${pageAudit.toString()})()`);
    result.ready = ready || (await session.waitUntil(page.ready, { timeoutMs: 3000 }));

    // ---- 键盘 Tab 焦点扫描 ----
    await session.evaluate(resetFocusScript());
    const tabSteps = [];
    for (let step = 0; step < MAX_TAB_STEPS; step += 1) {
      await session.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
      });
      await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
      });
      await sleep(35);
      const state = await session.evaluate(`(${collectFocusState.toString()})()`);
      if (state.kind !== 'inside') {
        tabSteps.push({ step, state });
        if (tabSteps.filter((item) => item.state.kind === 'outside').length >= 2) break;
        continue;
      }
      const previous = tabSteps.length ? tabSteps[tabSteps.length - 1] : null;
      tabSteps.push({ step, state });
      if (previous && previous.state.kind === 'inside' && previous.state.index === state.index) break;
    }
    const inside = tabSteps.filter((item) => item.state.kind === 'inside');
    const expectedOrder = result.audit?.focusOrder ?? null;
    const observed = inside.map((item) => item.state.index);
    let orderMismatch = null;
    if (expectedOrder && observed.length) {
      for (let index = 0; index < Math.min(expectedOrder.length, observed.length); index += 1) {
        if (expectedOrder[index] !== observed[index]) {
          orderMismatch = {
            at: index,
            expected: expectedOrder[index],
            actual: observed[index],
          };
          break;
        }
      }
    }
    result.focus = {
      tabSteps: inside.length,
      focusNotVisible: inside.filter((item) => !item.state.visibleFocus).map((item) => ({
        selector: item.state.tag,
        name: item.state.name,
        outline: item.state.outline,
        boxShadow: item.state.boxShadow,
      })),
      orderMismatch,
      mismatchDetail:
        orderMismatch && result.audit?.focusables
          ? {
              expected: result.audit.focusables.find((item) => item.index === orderMismatch.expected) ?? null,
              actual: result.audit.focusables.find((item) => item.index === orderMismatch.actual) ?? null,
            }
          : null,
      observed,
      expected: expectedOrder,
    };
    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    await session.close();
  }
  return result;
}

// ---------------------------------------------------------------------------
// 报告
// ---------------------------------------------------------------------------
function severityCounts(violations) {
  const counts = { serious: 0, moderate: 0, minor: 0 };
  for (const violation of violations) counts[violation.severity] += 1;
  return counts;
}

function summarizePage(result) {
  const violations = result.audit?.violations ?? [];
  const counts = severityCounts(violations);
  const focusIssues = [];
  if (result.focus) {
    if (result.focus.focusNotVisible.length) {
      focusIssues.push({
        severity: 'moderate',
        category: 'focus',
        message: `键盘聚焦时 ${result.focus.focusNotVisible.length} 个元素缺少可见焦点样式`,
        selector: result.focus.focusNotVisible[0]?.name ?? '',
        snippet: '',
      });
    }
    if (result.focus.orderMismatch) {
      focusIssues.push({
        severity: 'moderate',
        category: 'focus',
        message: `Tab 焦点顺序与 DOM 预期不一致（第 ${result.focus.orderMismatch.at + 1} 步）`,
        selector: '',
        snippet: '',
      });
    }
  }
  const all = [...violations, ...focusIssues];
  return {
    counts: severityCounts(all),
    total: all.length,
    violations: all,
    stats: result.audit?.stats ?? null,
    focus: result.focus,
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Nexus Feedback 无障碍（a11y）审计报告');
  lines.push('');
  lines.push(`- 生成时间：${report.generatedAt}`);
  lines.push(`- Chrome：CDP ${report.environment.chromePort}（${report.environment.chromeReused ? '复用已运行实例' : '脚本自动启动 headless'}）`);
  lines.push(`- 视口：${report.environment.viewport.width}×${report.environment.viewport.height}`);
  lines.push(`- 页面：${report.environment.baseAdmin} / ${report.environment.baseBoard} / ${report.environment.baseSubmit} / API ${report.environment.baseApi}`);
  lines.push('- 说明：DOM 级近似审计（可访问名称/标签/ARIA/对比度为近似实现），对比度按 computed color 与其祖先背景色计算；');
  lines.push('  发现的问题仅做报告，不影响退出码。');
  lines.push('');
  lines.push('## 汇总');
  lines.push('');
  lines.push('| 页面 | 严重 | 中等 | 轻微 | 对比度问题 | 可聚焦元素 | Tab 步数 | 判定 |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const page of report.pages) {
    const s = page.summary;
    if (!page.ok) {
      lines.push(`| ${page.page.label} | - | - | - | - | - | - | ❌ 采集失败 |`);
      continue;
    }
    const verdict = s.counts.serious > 0 ? '❌ FAIL（严重）' : s.counts.moderate > 0 ? '⚠️ WARN（中等）' : '✅ PASS';
    lines.push(
      `| ${page.page.label} | ${s.counts.serious} | ${s.counts.moderate} | ${s.counts.minor} | ` +
        `${page.summary.stats?.contrastViolations ?? 0} | ${page.summary.stats?.focusableCount ?? 0} | ` +
        `${page.summary.focus?.tabSteps ?? 0} | ${verdict} |`,
    );
  }
  lines.push('');
  lines.push('## 问题明细');
  lines.push('');
  for (const page of report.pages) {
    lines.push(`### ${page.page.label}`);
    lines.push('');
    if (!page.ok) {
      lines.push(`- ❌ 采集失败：${page.error}`);
      lines.push('');
      continue;
    }
    if (!page.summary.violations.length) {
      lines.push('- 未发现问题。');
      lines.push('');
      continue;
    }
    lines.push('| 级别 | 类别 | 说明 | 选择器 / 片段 |');
    lines.push('|---|---|---|---|');
    for (const violation of page.summary.violations.slice(0, 60)) {
      lines.push(
        `| ${SEVERITY_LABELS[violation.severity]} | ${CATEGORY_LABELS[violation.category] ?? violation.category} | ` +
          `${violation.message.replace(/\|/g, '\\|')} | ${(violation.selector || violation.snippet || '').replace(/\|/g, '\\|')} |`,
      );
    }
    if (page.summary.violations.length > 60) {
      lines.push(`| … | … | 其余 ${page.summary.violations.length - 60} 条见 JSON |  |`);
    }
    lines.push('');
    if (page.summary.focus?.orderMismatch) {
      lines.push(
        `> 焦点顺序：第 ${page.summary.focus.orderMismatch.at + 1} 步预期索引 ${page.summary.focus.orderMismatch.expected}，实际 ${page.summary.focus.orderMismatch.actual}。`,
      );
      lines.push('');
    }
    if (page.summary.focus?.focusNotVisible.length) {
      lines.push(
        `> 焦点不可见：${page.summary.focus.focusNotVisible
          .slice(0, 5)
          .map((item) => item.name || item.selector)
          .join('、')}`,
      );
      lines.push('');
    }
  }
  lines.push('## 复跑方式');
  lines.push('');
  lines.push('```bash');
  lines.push('pnpm a11y');
  lines.push('```');
  lines.push('');
  lines.push('JSON 报告包含每个问题的选择器、片段与完整明细。');
  lines.push('');
  return lines.join('\n');
}

function printConsoleTable(report) {
  const headers = ['页面', '严重', '中等', '轻微', '对比度', '可聚焦', 'Tab', '判定'];
  const widths = [20, 5, 5, 5, 7, 7, 5, 16];
  console.log('');
  console.log(headers.map((header, index) => padCell(header, widths[index])).join(''));
  console.log(widths.map((width) => '-'.repeat(width)).join(''));
  for (const page of report.pages) {
    if (!page.ok) {
      console.log(
        ['采集失败', '-', '-', '-', '-', '-', '-', 'FAIL'].map((cell, index) => padCell(cell, widths[index])).join(''),
      );
      continue;
    }
    const s = page.summary;
    const verdict = s.counts.serious > 0 ? 'FAIL（严重）' : s.counts.moderate > 0 ? 'WARN（中等）' : 'PASS';
    console.log(
      [
        page.page.label,
        String(s.counts.serious),
        String(s.counts.moderate),
        String(s.counts.minor),
        String(page.summary.stats?.contrastViolations ?? 0),
        String(page.summary.stats?.focusableCount ?? 0),
        String(page.summary.focus?.tabSteps ?? 0),
        verdict,
      ]
        .map((cell, index) => padCell(cell, widths[index]))
        .join(''),
    );
  }
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
  console.log('Nexus Feedback 无障碍（a11y）审计（CDP）');
  console.log(
    `admin=${options.baseAdmin}  board=${options.baseBoard}  submit=${options.baseSubmit}  api=${options.baseApi}`,
  );
  console.log(`视口：${VIEWPORT.width}×${VIEWPORT.height}；页面：submit / board 首页+详情 / admin 登录+dashboard+feedback+notifications`);

  const adminOrigin = new URL(options.baseAdmin).origin;
  let client = null;
  let auth = null;
  let chromeReused = false;
  const browserContexts = [];
  const pages = [];

  try {
    const { webSocketDebuggerUrl, reused } = await chromeManager.ensure(options.chromePort);
    chromeReused = reused;
    client = await CdpClient.connect(webSocketDebuggerUrl);
    chromeManager.client = client;
    console.log(`Chrome ${reused ? '复用已有实例' : '已自动启动'}（CDP 端口 ${options.chromePort}）`);

    auth = await loginDemo(options);
    console.log(`登录态准备完成：${auth.member.display_name ?? auth.member.email}（${auth.member.role}）`);

    const detailUrl = await resolveBoardDetailUrl(options);
    console.log(detailUrl ? `board 详情 URL：${detailUrl}` : '⚠️ 未能获取 demo 反馈详情 ID，跳过 board 详情');

    const pageList = buildPages(options, detailUrl).filter((page) => {
      if (!options.only) return true;
      return options.only.split(',').map((key) => key.trim()).filter(Boolean).includes(page.key);
    });
    if (!pageList.length) throw new Error(`--only 未匹配到页面：${options.only}`);
    for (const page of pageList) {
      if (page.unavailableReason) {
        pages.push({
          page: { key: page.key, label: page.label, url: page.url ?? '' },
          ok: false,
          error: page.unavailableReason,
          audit: null,
          focus: null,
          summary: { counts: { serious: 0, moderate: 0, minor: 0 }, total: 0, violations: [], stats: null, focus: null },
        });
        continue;
      }
      const { browserContextId } = await client.send('Target.createBrowserContext', {});
      browserContexts.push(browserContextId);
      console.log(`\n▶ 审计 ${page.label}`);
      const result = await auditPage(client, browserContextId, page, options, auth, adminOrigin);
      await client.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
      browserContexts.pop();
      const summary = summarizePage(result);
      pages.push({ ...result, summary });
      if (result.ok) {
        console.log(
          `  完成：严重 ${summary.counts.serious} / 中等 ${summary.counts.moderate} / 轻微 ${summary.counts.minor}；` +
            `对比度问题 ${summary.stats?.contrastViolations ?? 0}；Tab ${summary.focus?.tabSteps ?? 0} 步`,
        );
      } else {
        console.log(`  失败：${result.error}`);
      }
    }

    const report = {
      generatedAt: startedAt.toISOString(),
      environment: {
        chromePort: options.chromePort,
        chromeReused,
        viewport: VIEWPORT,
        baseAdmin: options.baseAdmin,
        baseBoard: options.baseBoard,
        baseSubmit: options.baseSubmit,
        baseApi: options.baseApi,
      },
      pages,
    };

    mkdirSync(REPORT_DIR, { recursive: true });
    const stamp = stampFor(startedAt);
    const jsonPath = path.join(REPORT_DIR, `report-${stamp}.json`);
    const mdPath = path.join(REPORT_DIR, `report-${stamp}.md`);
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    writeFileSync(mdPath, buildMarkdown(report), 'utf8');

    printConsoleTable(report);
    console.log('');
    const total = pages.reduce(
      (acc, page) => {
        if (!page.ok) return acc;
        acc.serious += page.summary.counts.serious;
        acc.moderate += page.summary.counts.moderate;
        acc.minor += page.summary.counts.minor;
        return acc;
      },
      { serious: 0, moderate: 0, minor: 0 },
    );
    console.log(`合计：严重 ${total.serious} / 中等 ${total.moderate} / 轻微 ${total.minor}`);
    const failedPages = pages.filter((page) => page.ok && page.summary.counts.serious > 0).map((page) => page.page.label);
    if (failedPages.length) console.log(`存在严重问题的页面：${failedPages.join('、')}`);
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
    console.error('a11y 审计失败:', error instanceof Error ? error.message : error);
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
    console.error('a11y 脚本崩溃:', error);
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
