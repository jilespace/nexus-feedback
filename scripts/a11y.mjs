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
import { fileURLToPath, pathToFileURL } from 'node:url';

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
    theme: 'light',
    interactions: false,
    failOn: 'none',
    maxMedium: null,
    help: false,
  };
  const keyMap = {
    'base-admin': 'baseAdmin',
    'base-board': 'baseBoard',
    'base-api': 'baseApi',
    'base-submit': 'baseSubmit',
    'chrome-port': 'chromePort',
    only: 'only',
    theme: 'theme',
    'fail-on': 'failOn',
    'max-medium': 'maxMedium',
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--interactions') {
      options.interactions = true;
      continue;
    }
    const match = arg.match(/^--([a-z-]+)=(.*)$/);
    if (!match) throw new Error(`未知参数: ${arg}（使用 --help 查看用法）`);
    const optionKey = keyMap[match[1]];
    if (!optionKey) throw new Error(`未知参数: ${arg}（使用 --help 查看用法）`);
    const value = String(match[2] ?? '').trim().replace(/\/+$/, '');
    if (!value) throw new Error(`参数 --${match[1]} 需要一个值`);
    if (optionKey === 'chromePort' || optionKey === 'maxMedium') {
      const numeric = Number(value);
      if (!Number.isInteger(numeric)) throw new Error(`--${match[1]} 需要整数`);
      options[optionKey] = numeric;
      continue;
    }
    options[optionKey] = value;
  }
  if (Number.isNaN(options.chromePort)) throw new Error('--chrome-port 需要数字');
  if (!['light', 'dark', 'both'].includes(options.theme)) {
    throw new Error(`--theme 仅支持 light / dark / both（当前 ${options.theme}）`);
  }
  if (!['none', 'serious', 'medium'].includes(options.failOn)) {
    throw new Error(`--fail-on 仅支持 none / serious / medium（当前 ${options.failOn}）`);
  }
  if (options.maxMedium !== null && options.maxMedium < 0) {
    throw new Error('--max-medium 不能为负数');
  }
  return options;
}

const USAGE = `Nexus Feedback 无障碍审计（CDP，零依赖）

用法:
  pnpm a11y                       # 仅审计并输出报告（默认 --fail-on=none）
  pnpm a11y:check                 # 质量门禁：存在严重问题则退出码 1
  node scripts/a11y.mjs [参数]

参数:
  --base-admin=<url>   管理后台地址（默认 http://localhost:8080）
  --base-board=<url>   公开看板地址（默认 http://localhost:8082）
  --base-api=<url>     API 地址（默认 http://localhost:3000）
  --base-submit=<url>  公开提交页地址（默认 http://localhost:8081）
  --chrome-port=<port> Chrome CDP 端口（默认 9222；缺失时自动启动 headless Chrome）
  --only=<keys>        只审计指定页面（逗号分隔：submit,board-home,board-detail,admin-login,admin-dashboard,admin-feedback,admin-feedback-detail,admin-notifications,admin-notification-preferences）
  --theme=<mode>       主题：light（默认）/ dark / both（两套都审计，报告按页面×主题分组）
  --interactions       追加键盘交互检查：命令面板、dialog 焦点陷阱/Esc/焦点恢复、popover、Switch Space 切换、表单 Tab 顺序
  --fail-on=<mode>     门禁阈值：none（默认，不影响退出码）/ serious（存在严重即失败）/ medium（存在严重或中等超限即失败）；
                       --theme=both 时任一主题超阈值即失败；键盘交互问题按「严重」计入
  --max-medium=<n>     仅 --fail-on=medium 时生效：每个主题允许的中等问题总数上限（默认 0）
  --help               显示本帮助

门禁退出码：0 = PASS（或门禁未启用）；1 = FAIL（超阈值或环境/采集错误）。
覆盖：提交页、board 首页/详情、admin 登录页 + dashboard/feedback/notifications（登录态注入）。
输出：终端中文表格 + 门禁结果 + .tools/a11y/report-{timestamp}.json/.md（JSON 含 gate 字段）。`;

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

  async init({ browserContextId, viewport, colorScheme = 'light' }) {
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
      features: [{ name: 'prefers-color-scheme', value: colorScheme }],
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

async function resolveAdminFeedbackId(options, auth) {
  const response = await httpJson(`${options.baseApi}/api/v1/admin/feedback?page_size=1`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return response.json?.data?.items?.[0]?.id ?? null;
}

async function resolveDemoProjectId(options, auth) {
  const response = await httpJson(`${options.baseApi}/api/v1/org/projects`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const projects = response.json?.data ?? [];
  const list = Array.isArray(projects) ? projects : (projects.items ?? []);
  const project = list.find((item) => item.slug === DEMO_PROJECT_SLUG) ?? list[0];
  return project?.id ?? null;
}

function buildThemeInitScript(adminOrigin, auth, theme) {
  const authBlock = auth
    ? `localStorage.setItem('admin_token', ${JSON.stringify(auth.token)});
      localStorage.setItem('org_member', ${JSON.stringify(JSON.stringify(auth.member))});
      localStorage.setItem('org_info', ${JSON.stringify(JSON.stringify(auth.organization))});`
    : '';
  return `(() => {
    try {
      // board / admin 都从 localStorage.theme 读取初始主题（board 在 index.html 内联脚本中应用）
      localStorage.setItem('theme', ${JSON.stringify(theme)});
      if (location.origin !== ${JSON.stringify(adminOrigin)}) return;
      localStorage.setItem('lang', 'zh');
      ${authBlock}
    } catch (error) { /* localStorage 不可用时忽略 */ }
  })();`;
}

const THEME_LABELS = { light: '亮色', dark: '暗色' };

function themeLabel(theme) {
  return THEME_LABELS[theme] ?? theme;
}

const ADMIN_READY = `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`;

function buildPages(options, detailUrl, adminFeedbackId, demoProjectId) {
  const pages = [
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
  // 以下页面只用于 `--interactions` 键盘矩阵：不进入常规 DOM/焦点审计口径。
  if (options.interactions) {
    // 详情页依赖 admin 列表返回的第一条反馈；取不到时显式记 unavailable。
    pages.splice(6, 0, {
      key: 'admin-feedback-detail',
      label: 'feedback 详情（登录态，仅交互）',
      url: adminFeedbackId ? `${options.baseAdmin}/feedback/${adminFeedbackId}` : `${options.baseAdmin}/feedback`,
      auth: true,
      ready: `(document.querySelector('main')?.innerText.trim().length ?? 0) > 80`,
      interactionOnly: true,
      unavailableReason: adminFeedbackId ? null : '未能从 admin API 取到 feedback ID',
    });
    // 项目级通知偏好页（共享 Switch 组件；与 notifications 中心页分开，避免与通知内容改造互相干扰）。
    pages.push({
      key: 'admin-notification-preferences',
      label: 'notification preferences（登录态）',
      url: demoProjectId
        ? `${options.baseAdmin}/projects/${demoProjectId}/notifications`
        : `${options.baseAdmin}/notifications`,
      auth: true,
      ready: ADMIN_READY,
      interactionOnly: true,
      unavailableReason: demoProjectId ? null : '未能从 admin API 取到 demo 项目 ID',
    });
  }
  return pages;
}

// ---------------------------------------------------------------------------
// 键盘交互检查（--interactions）
// ---------------------------------------------------------------------------
const VK_CODES = {
  Tab: 9,
  Escape: 27,
  Enter: 13,
  Space: 32,
  ArrowDown: 40,
  ArrowUp: 38,
  Slash: 191,
  KeyK: 75,
};

function inPageFocusInfo() {
  const el = document.activeElement;
  if (!el) return null;
  const dialog = el.closest ? el.closest('[role="dialog"]') : null;
  const dialogLabel = dialog
    ? dialog.getAttribute('aria-label') ||
      (dialog.getAttribute('aria-labelledby')
        ? (document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent || '').trim()
        : '') ||
      (dialog.querySelector('h1, h2, h3')?.textContent || '').trim().slice(0, 60) ||
      ''
    : null;
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    label: (el.getAttribute('aria-label') || el.innerText || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60),
    inDialog: Boolean(dialog),
    dialogLabel,
  };
}

function inPageDialogList() {
  return [...document.querySelectorAll('[role="dialog"]')]
    .filter((dialog) => dialog.getClientRects().length > 0)
    .map((dialog) => {
      const labelledBy = dialog.getAttribute('aria-labelledby');
      const label =
        dialog.getAttribute('aria-label') ||
        (labelledBy ? (document.getElementById(labelledBy)?.textContent || '').trim() : '') ||
        (dialog.querySelector('h1, h2, h3')?.textContent || '').trim().slice(0, 60) ||
        '';
      return {
        label,
        focusables: dialog.querySelectorAll(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ).length,
      };
    });
}

function inPageFocusFirstDialog() {
  const dialog = [...document.querySelectorAll('[role="dialog"]')]
    .filter((item) => item.getClientRects().length > 0)
    .pop();
  if (!dialog) return false;
  const items = [...dialog.querySelectorAll(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )].filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
  if (items[0]) {
    items[0].focus();
    return true;
  }
  dialog.setAttribute('tabindex', '-1');
  dialog.focus();
  return true;
}

function inPagePaletteActive() {
  const dialog = document.querySelector('[role="dialog"][aria-label]');
  if (!dialog) return null;
  const buttons = [...dialog.querySelectorAll('button[id^="cmd-item-"]')];
  const active = buttons.find((button) =>
    [...button.querySelectorAll('kbd')].some((kbd) => kbd.textContent.trim() === '↵'),
  );
  return {
    count: buttons.length,
    active: active ? (active.innerText || active.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) : null,
  };
}

async function pressKey(session, { key, code, modifiers = 0, text }) {
  const windowsVirtualKeyCode = VK_CODES[code] ?? 0;
  const base = { key, code, modifiers, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode };
  if (text) {
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text });
  } else {
    await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  }
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

async function readFocus(session) {
  return session.evaluate(`(${inPageFocusInfo.toString()})()`);
}

async function readDialogs(session) {
  return session.evaluate(`(${inPageDialogList.toString()})()`);
}

async function focusFirstInDialog(session) {
  return session.evaluate(`(${inPageFocusFirstDialog.toString()})()`);
}

async function pressTab(session, count, shift = false) {
  for (let index = 0; index < count; index += 1) {
    await pressKey(session, { key: 'Tab', code: 'Tab', modifiers: shift ? 8 : 0 });
    await sleep(35);
  }
}

async function dialogFocusTrapCheck(session, dialogLabel, hintSteps = 10) {
  await focusFirstInDialog(session);
  const dialogList = await readDialogs(session);
  const focusableCount = dialogList.length ? dialogList[dialogList.length - 1].focusables : 0;
  const tabSteps = Math.min(Math.max(hintSteps, focusableCount + 3), 40);
  const states = [];
  for (let index = 0; index < tabSteps; index += 1) {
    await pressTab(session, 1);
    const focus = await readFocus(session);
    states.push(focus);
    if (!focus || !focus.inDialog || (dialogLabel && focus.dialogLabel !== dialogLabel)) {
      return { pass: false, escapedAt: index + 1, focus };
    }
  }
  for (let index = 0; index < 3; index += 1) {
    await pressTab(session, 1, true);
    const focus = await readFocus(session);
    if (!focus || !focus.inDialog) return { pass: false, escapedAt: tabSteps + index + 1, focus };
  }
  return { pass: true, escapedAt: null, focus: null };
}

async function closeAllDialogs(session) {
  for (let index = 0; index < 4; index += 1) {
    const dialogs = await readDialogs(session);
    if (!dialogs.length) break;
    await pressKey(session, { key: 'Escape', code: 'Escape' });
    await sleep(200);
  }
}

async function focusStableControl(session) {
  return session.evaluate(`(() => {
    const candidates = [...document.querySelectorAll('aside a[href], aside button, main a[href], main button')];
    for (const el of candidates) {
      if (!el.getClientRects().length) continue;
      el.focus();
      if (document.activeElement === el) {
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          label: (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60),
        };
      }
    }
    return null;
  })()`);
}

function sameFocus(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  return a.tag === b.tag && a.label === b.label;
}

async function runPaletteInteraction(session) {
  const result = {
    scenario: 'command-palette',
    status: 'fail',
    checks: { opened: false, focusTrap: false, arrowKeys: false, enterWorks: false, escClosed: false, focusRestored: false },
    notes: [],
    issues: [],
  };
  const addIssue = (message) => result.issues.push({ severity: 'serious', category: 'interaction', message, selector: '', snippet: '' });
  await closeAllDialogs(session);
  const restoreTarget = await focusStableControl(session);

  await pressKey(session, { key: 'k', code: 'KeyK', modifiers: 2 });
  result.checks.opened = await session.waitUntil(
    `!!document.querySelector('[role="dialog"][aria-label="命令面板"]')`,
    { timeoutMs: 3000 },
  );
  if (!result.checks.opened) {
    addIssue('Ctrl+K 未能打开命令面板');
    return result;
  }
  await sleep(300);
  const dialogs = await readDialogs(session);
  const dialogLabel = dialogs.length ? dialogs[dialogs.length - 1].label : '';

  const trap = await dialogFocusTrapCheck(session, dialogLabel, 10);
  result.checks.focusTrap = trap.pass;
  if (!trap.pass) addIssue(`命令面板 Tab 焦点跑出 dialog（第 ${trap.escapedAt} 次 Tab）`);

  await session.evaluate(`(() => { const input = document.querySelector('[role="dialog"] input'); if (input) input.focus(); return true; })()`);
  const first = await session.evaluate(`(${inPagePaletteActive.toString()})()`);
  await pressKey(session, { key: 'ArrowDown', code: 'ArrowDown' });
  await sleep(120);
  const second = await session.evaluate(`(${inPagePaletteActive.toString()})()`);
  await pressKey(session, { key: 'ArrowUp', code: 'ArrowUp' });
  await sleep(120);
  const third = await session.evaluate(`(${inPagePaletteActive.toString()})()`);
  result.checks.arrowKeys = Boolean(
    first?.active && second?.active && second.active !== first.active && third?.active === first.active,
  );
  result.notes.push(`方向键：${first?.active ?? '无'} → ${second?.active ?? '无'} → ${third?.active ?? '无'}`);
  if (!result.checks.arrowKeys) addIssue('命令面板方向键未改变/恢复选中项');

  await session.evaluate(`(() => { const input = document.querySelector('[role="dialog"] input'); if (input) { input.focus(); input.select(); } return true; })()`);
  await session.send('Input.insertText', { text: '快捷键' });
  await sleep(450);
  const filtered = await session.evaluate(`(${inPagePaletteActive.toString()})()`);
  result.notes.push(`过滤后选中：${filtered?.active ?? '无'}`);
  await pressKey(session, { key: 'Enter', code: 'Enter' });
  await sleep(450);
  const afterEnter = await readDialogs(session);
  const paletteStillOpen = afterEnter.some((dialog) => dialog.label === '命令面板');
  result.checks.enterWorks = !paletteStillOpen;
  if (paletteStillOpen) addIssue('命令面板 Enter 未执行选中项（面板仍打开）');
  await closeAllDialogs(session);

  const escTarget = await focusStableControl(session);
  await pressKey(session, { key: 'k', code: 'KeyK', modifiers: 2 });
  await session.waitUntil(`!!document.querySelector('[role="dialog"][aria-label="命令面板"]')`, { timeoutMs: 3000 });
  await sleep(250);
  await pressKey(session, { key: 'Escape', code: 'Escape' });
  await sleep(400);
  const afterEsc = await readDialogs(session);
  result.checks.escClosed = !afterEsc.some((dialog) => dialog.label === '命令面板');
  const focusAfter = await readFocus(session);
  result.checks.focusRestored = sameFocus(focusAfter, escTarget);
  result.notes.push(`触发元素：${escTarget?.tag ?? '无'}「${escTarget?.label ?? ''}」；关闭后焦点：${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」`);
  if (!result.checks.escClosed) addIssue('命令面板 Esc 未能关闭');
  if (!result.checks.focusRestored) {
    addIssue(`命令面板关闭后焦点未恢复到触发前元素（当前 ${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」）`);
  }
  result.status = result.issues.length ? 'fail' : 'pass';
  return result;
}

async function runKeyboardModalInteraction(session) {
  const result = {
    scenario: 'dialog（? 快捷键帮助）',
    status: 'fail',
    checks: { opened: false, focusTrap: false, escClosed: false, focusRestored: false },
    notes: [],
    issues: [],
  };
  const addIssue = (message) => result.issues.push({ severity: 'serious', category: 'interaction', message, selector: '', snippet: '' });
  await closeAllDialogs(session);
  const trigger = await focusStableControl(session);
  await pressKey(session, { key: '?', code: 'Slash', modifiers: 8, text: '?' });
  result.checks.opened = await session.waitUntil(`!!document.querySelector('[role="dialog"]')`, { timeoutMs: 3000 });
  if (!result.checks.opened) {
    addIssue('按 ? 未能打开快捷键帮助 dialog');
    return result;
  }
  await sleep(250);
  const dialogs = await readDialogs(session);
  const dialogLabel = dialogs.length ? dialogs[dialogs.length - 1].label : '';
  result.notes.push(`dialog：${dialogLabel || '未命名'}`);

  const trap = await dialogFocusTrapCheck(session, dialogLabel, 8);
  result.checks.focusTrap = trap.pass;
  if (!trap.pass) addIssue(`dialog Tab 焦点跑出（第 ${trap.escapedAt} 次 Tab）`);

  await pressKey(session, { key: 'Escape', code: 'Escape' });
  await sleep(350);
  const afterEsc = await readDialogs(session);
  result.checks.escClosed = afterEsc.length === 0;
  if (!result.checks.escClosed) addIssue('dialog Esc 未关闭');

  const focusAfter = await readFocus(session);
  result.checks.focusRestored = sameFocus(focusAfter, trigger);
  result.notes.push(`触发元素：${trigger?.tag ?? '无'}「${trigger?.label ?? ''}」；关闭后焦点：${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」`);
  if (!result.checks.focusRestored) {
    addIssue(`dialog 关闭后焦点未恢复到触发元素（当前 ${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」）`);
  }
  result.status = result.issues.length ? 'fail' : 'pass';
  return result;
}

async function runButtonModalInteraction(session) {
  const result = {
    scenario: 'dialog（按钮触发：清空全部）',
    status: 'skip',
    checks: { opened: false, focusTrap: false, escClosed: false, focusRestored: false },
    notes: [],
    issues: [],
  };
  const addIssue = (message) => result.issues.push({ severity: 'serious', category: 'interaction', message, selector: '', snippet: '' });
  await closeAllDialogs(session);
  const trigger = await session.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(
      (item) => (item.innerText || '').trim().includes('清空全部') && !item.disabled && item.getClientRects().length > 0,
    );
    if (!button) return null;
    button.scrollIntoView({ block: 'center' });
    button.focus();
    const rect = button.getBoundingClientRect();
    return {
      tag: 'button',
      label: (button.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 60),
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  })()`);
  if (!trigger) {
    result.reason = '未找到可用的「清空全部」按钮（通知列表可能为空）';
    return result;
  }
  await sleep(200);
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: trigger.x, y: trigger.y });
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: trigger.x, y: trigger.y, button: 'left', clickCount: 1 });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: trigger.x, y: trigger.y, button: 'left', clickCount: 1 });
  result.checks.opened = await session.waitUntil(`!!document.querySelector('[role="dialog"]')`, { timeoutMs: 3000 });
  if (!result.checks.opened) {
    addIssue('点击「清空全部」后 dialog 未打开');
    return result;
  }
  await sleep(250);
  const dialogs = await readDialogs(session);
  const dialogLabel = dialogs.length ? dialogs[dialogs.length - 1].label : '';
  result.notes.push(`dialog：${dialogLabel || '未命名'}`);

  const trap = await dialogFocusTrapCheck(session, dialogLabel, 8);
  result.checks.focusTrap = trap.pass;
  if (!trap.pass) addIssue(`dialog Tab 焦点跑出（第 ${trap.escapedAt} 次 Tab）`);

  await pressKey(session, { key: 'Escape', code: 'Escape' });
  await sleep(350);
  const afterEsc = await readDialogs(session);
  result.checks.escClosed = afterEsc.length === 0;
  if (!result.checks.escClosed) addIssue('dialog Esc 未关闭');

  const focusAfter = await readFocus(session);
  result.checks.focusRestored = sameFocus(focusAfter, trigger);
  result.notes.push(`触发按钮：${trigger?.label ?? '无'}；关闭后焦点：${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」`);
  if (!result.checks.focusRestored) {
    addIssue(`dialog 关闭后焦点未回到触发按钮（当前 ${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」）`);
  }
  result.status = result.issues.length ? 'fail' : 'pass';
  return result;
}

// ---------------------------------------------------------------------------
// 通用键盘场景（配置化场景矩阵）
// ---------------------------------------------------------------------------
function inPageFindTrigger(spec) {
  const candidates = [
    ...document.querySelectorAll(
      'button, [role="button"], a[href], input[type="submit"], input[type="button"]',
    ),
  ];
  const normalize = (el) =>
    (el.getAttribute('aria-label') || el.innerText || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80);
  const visible = (el) => el.getClientRects().length > 0 && !el.disabled;
  let target = null;
  if (spec.selector) {
    target = candidates.find((el) => el.matches(spec.selector) && visible(el)) ?? null;
  }
  if (!target && spec.text) {
    target = candidates.find((el) => visible(el) && normalize(el).includes(spec.text)) ?? null;
  }
  if (!target && spec.ariaLabel) {
    target = candidates.find(
      (el) => visible(el) && (el.getAttribute('aria-label') || '').includes(spec.ariaLabel),
    ) ?? null;
  }
  if (!target) return null;
  target.scrollIntoView({ block: 'center' });
  target.focus();
  const rect = target.getBoundingClientRect();
  return {
    tag: target.tagName.toLowerCase(),
    id: target.id || '',
    label: normalize(target),
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function inPagePopoverFocus(selector) {
  const el = document.querySelector(selector);
  if (!el || !el.getClientRects().length) return { open: false, focused: false };
  return { open: true, focused: document.activeElement === el };
}

function inPageVisibleSwitches() {
  return [...document.querySelectorAll('[role="switch"]')].filter(
    (el) => el.getClientRects().length > 0 && !el.disabled,
  ).length;
}

function inPageFirstFormFocusable(formSelector) {
  const form = document.querySelector(formSelector);
  if (!form) return null;
  const items = [
    ...form.querySelectorAll(
      'input:not([type="hidden"]), textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.disabled && el.getClientRects().length > 0);
  const first = items[0];
  if (!first) return null;
  return { id: first.id || '', tag: first.tagName.toLowerCase(), type: first.getAttribute('type') || '' };
}

function inPageSwitchState(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return {
    checked: el.getAttribute('aria-checked'),
    disabled: el.disabled === true,
    focused: document.activeElement === el,
    label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 60),
  };
}

function inPageActiveDescriptor(formSelector) {
  const el = document.activeElement;
  if (!el) return null;
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    type: el.getAttribute('type') || '',
    inForm: formSelector ? Boolean(el.closest(formSelector)) : false,
    label: (el.getAttribute('aria-label') || el.innerText || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60),
  };
}

async function clickAt(session, point) {
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

function newScenarioResult(scenario, checks) {
  return { scenario, status: 'fail', checks, notes: [], issues: [] };
}

function addScenarioIssue(result, message) {
  result.issues.push({ severity: 'serious', category: 'interaction', message, selector: '', snippet: '' });
}

async function runDialogInteraction(session, opts = {}) {
  const result = newScenarioResult(opts.scenario ?? 'dialog', {
    opened: false,
    focusTrap: false,
    escClosed: false,
    focusRestored: false,
  });
  const triggerText = opts.triggerText ?? '';
  await closeAllDialogs(session);
  const trigger = await session.evaluate(
    `(${inPageFindTrigger.toString()})(${JSON.stringify({ text: triggerText, ariaLabel: opts.triggerAriaLabel, selector: opts.triggerSelector })})`,
  );
  if (!trigger) {
    if (opts.optional) {
      result.status = 'skip';
      result.reason = `未找到可选触发按钮「${triggerText}」`;
      return result;
    }
    addScenarioIssue(result, `未找到触发按钮「${triggerText}」`);
    return result;
  }
  await sleep(120);
  await clickAt(session, trigger);
  const labelJson = JSON.stringify(opts.dialogLabelIncludes ?? '');
  result.checks.opened = await session.waitUntil(
    `(() => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.getClientRects().length > 0);
      return dialogs.some((d) => {
        if (!${labelJson}) return true;
        const labelledBy = d.getAttribute('aria-labelledby');
        const text = [
          d.getAttribute('aria-label') || '',
          labelledBy ? (document.getElementById(labelledBy)?.textContent || '') : '',
          (d.querySelector('h1, h2, h3')?.textContent || ''),
          d.innerText || '',
        ].join(' ');
        return text.includes(${labelJson});
      });
    })()`,
    { timeoutMs: 3000 },
  );
  if (!result.checks.opened) {
    addScenarioIssue(result, `点击「${triggerText}」后未打开 dialog`);
    return result;
  }
  await sleep(250);
  const dialogs = await readDialogs(session);
  const dialogLabel = dialogs.length ? dialogs[dialogs.length - 1].label : '';
  result.notes.push(`dialog：${dialogLabel || '未命名'}`);

  const trap = await dialogFocusTrapCheck(session, dialogLabel, 10);
  result.checks.focusTrap = trap.pass;
  if (!trap.pass) addScenarioIssue(result, `dialog Tab 焦点跑出（第 ${trap.escapedAt} 次 Tab）`);

  await pressKey(session, { key: 'Escape', code: 'Escape' });
  await sleep(400);
  const afterEsc = await readDialogs(session);
  result.checks.escClosed = afterEsc.length === 0;
  if (!result.checks.escClosed) addScenarioIssue(result, 'dialog Esc 未关闭');

  const focusAfter = await readFocus(session);
  result.checks.focusRestored = sameFocus(focusAfter, trigger);
  result.notes.push(
    `触发：${trigger.tag}「${trigger.label}」；关闭后焦点：${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」`,
  );
  if (!result.checks.focusRestored) {
    addScenarioIssue(result, `dialog 关闭后焦点未恢复到触发按钮（当前 ${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」）`);
  }
  result.status = result.issues.length ? 'fail' : 'pass';
  return result;
}

async function runPopoverInteraction(session, opts = {}) {
  const result = newScenarioResult(opts.scenario ?? 'popover', {
    opened: false,
    focusInPopover: false,
    escClosed: false,
    focusRestored: false,
  });
  const popoverSelector = opts.popoverSelector ?? '';
  await closeAllDialogs(session);
  const trigger = await session.evaluate(
    `(${inPageFindTrigger.toString()})(${JSON.stringify({ text: opts.triggerText, ariaLabel: opts.triggerAriaLabel, selector: opts.triggerSelector })})`,
  );
  if (!trigger) {
    addScenarioIssue(result, `未找到 popover 触发按钮「${opts.triggerText ?? opts.triggerAriaLabel ?? ''}」`);
    return result;
  }
  await sleep(120);
  await clickAt(session, trigger);
  result.checks.opened = await session.waitUntil(
    `(${inPagePopoverFocus.toString()})(${JSON.stringify(popoverSelector)}).open`,
    { timeoutMs: 2500 },
  );
  if (!result.checks.opened) {
    addScenarioIssue(result, '点击后 popover 未打开');
    return result;
  }
  await sleep(200);
  const focusState = await session.evaluate(`(${inPagePopoverFocus.toString()})(${JSON.stringify(popoverSelector)})`);
  result.checks.focusInPopover = focusState.focused;
  if (!focusState.focused) addScenarioIssue(result, 'popover 打开后焦点未进入弹层内容');

  await pressKey(session, { key: 'Escape', code: 'Escape' });
  await sleep(350);
  const closedState = await session.evaluate(`(${inPagePopoverFocus.toString()})(${JSON.stringify(popoverSelector)})`);
  result.checks.escClosed = !closedState.open;
  if (!result.checks.escClosed) addScenarioIssue(result, 'popover Esc 未关闭');

  const focusAfter = await readFocus(session);
  result.checks.focusRestored = sameFocus(focusAfter, trigger);
  result.notes.push(
    `触发：${trigger.tag}「${trigger.label}」；关闭后焦点：${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」`,
  );
  if (!result.checks.focusRestored) {
    addScenarioIssue(
      result,
      `popover 关闭后焦点未恢复到触发按钮（当前 ${focusAfter?.tag ?? '无'}「${focusAfter?.label ?? ''}」）`,
    );
  }
  result.status = result.issues.length ? 'fail' : 'pass';
  return result;
}

async function readSwitchState(session, selector) {
  return session.evaluate(`(${inPageSwitchState.toString()})(${JSON.stringify(selector)})`);
}

async function runSwitchInteraction(session, opts = {}) {
  const result = newScenarioResult(opts.scenario ?? 'switch', {
    found: false,
    keyboardReachable: false,
    spaceToggles: false,
    focusRetained: false,
  });
  const selector = opts.selector ?? '[role="switch"]';
  await closeAllDialogs(session);
  const count = await session.evaluate(
    `(() => [...document.querySelectorAll(${JSON.stringify(selector)})].filter((el) => el.getClientRects().length > 0 && !el.disabled).length)()`,
  );
  result.checks.found = count > 0;
  if (!count) {
    result.status = 'skip';
    result.reason = opts.emptyReason ?? '页面无可见且可用的 switch（空态或数据未准备）';
    return result;
  }
  const probe = await session.evaluate(`(() => {
    const all = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.getClientRects().length > 0 && !el.disabled);
    const index = all.findIndex((el) => el.matches(${JSON.stringify(selector)}));
    if (index < 0) return null;
    const target = all[index];
    const previous = index > 0 ? all[index - 1] : null;
    target.scrollIntoView({ block: 'center' });
    if (previous) previous.focus();
    const checked = target.getAttribute('aria-checked');
    return {
      viaTab: Boolean(previous),
      label: (target.getAttribute('aria-label') || target.innerText || '').trim().slice(0, 60),
      checked,
      disabled: target.disabled === true,
    };
  })()`);
  if (!probe) {
    result.status = 'skip';
    result.reason = '未能定位 switch 元素';
    return result;
  }
  if (probe.viaTab) {
    await pressKey(session, { key: 'Tab', code: 'Tab' });
    await sleep(150);
    result.checks.keyboardReachable = await session.evaluate(
      `document.activeElement?.matches?.(${JSON.stringify(selector)}) ?? false`,
    );
  } else {
    await session.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el?.focus(); return true; })()`,
    );
    result.checks.keyboardReachable = await session.evaluate(
      `document.activeElement?.matches?.(${JSON.stringify(selector)}) ?? false`,
    );
    result.notes.push('switch 是页面首个可聚焦控件，直接聚焦后测试 Space');
  }
  if (!result.checks.keyboardReachable) addScenarioIssue(result, `Tab 无法到达 switch「${probe.label}」`);

  await pressKey(session, { key: ' ', code: 'Space', text: ' ' });
  // 偏好保存通常是异步的：轮询等待 aria-checked 变化/控件恢复可用，避免竞态误报。
  let toggled = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(150);
    const state = await readSwitchState(session, selector);
    if (!state) break;
    if (state.checked !== probe.checked) {
      toggled = state;
      break;
    }
  }
  result.notes.push(`Space 后 aria-checked：${probe.checked} → ${toggled?.checked ?? '未变化'}`);
  if (!toggled) {
    addScenarioIssue(result, 'Space 未切换 switch 状态');
    result.status = 'fail';
    return result;
  }
  // 恢复原状态，避免留下测试副作用。
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await readSwitchState(session, selector);
    if (state && !state.disabled) break;
    await sleep(150);
  }
  await pressKey(session, { key: ' ', code: 'Space', text: ' ' });
  let restored = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(150);
    const state = await readSwitchState(session, selector);
    if (state && state.checked === probe.checked && !state.disabled) {
      restored = state;
      break;
    }
  }
  result.checks.spaceToggles = Boolean(restored);
  result.checks.focusRetained = Boolean(restored?.focused);
  if (!result.checks.spaceToggles) addScenarioIssue(result, '再次 Space 未能恢复 switch 原状态（测试副作用需人工检查）');
  if (!result.checks.focusRetained) addScenarioIssue(result, 'Space 切换后焦点离开 switch');
  result.status = result.issues.length ? 'fail' : 'pass';
  return result;
}


async function runTabOrderInteraction(session, opts = {}) {
  const result = newScenarioResult(opts.scenario ?? 'tab-order', {
    firstFieldInForm: false,
    orderCorrect: false,
    submitReachable: false,
  });
  const formSelector = opts.formSelector ?? '#feedback-form';
  const expectedIds = opts.expectedIds ?? ['feedback-title', 'feedback-content', 'feedback-contact'];
  const first = await session.evaluate(`(${inPageFirstFormFocusable.toString()})(${JSON.stringify(formSelector)})`);
  result.checks.firstFieldInForm = first?.id === expectedIds[0];
  result.notes.push(`首个表单控件：${first?.id || first?.tag || '无'}`);
  if (!result.checks.firstFieldInForm) {
    addScenarioIssue(result, `表单首个可聚焦控件不是「${expectedIds[0]}」（实际 ${first?.id || first?.tag || '无'}）`);
  }

  await session.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(`#${expectedIds[0]}`)}); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } return true; })()`,
  );
  const observed = [];
  const maxTabs = opts.maxTabs ?? 16;
  for (let index = 0; index < maxTabs; index += 1) {
    await pressKey(session, { key: 'Tab', code: 'Tab' });
    await sleep(70);
    const active = await session.evaluate(
      `(${inPageActiveDescriptor.toString()})(${JSON.stringify(formSelector)})`,
    );
    if (!active) break;
    observed.push(active);
    if (active.type === 'submit' || /提交/.test(active.label)) break;
    if (index >= 2 && !active.inForm) break;
  }
  const ids = observed.map((item) => item.id).filter(Boolean);
  // 当前焦点已人工定位到首个期望字段，序列从它开始计入。
  const sequence = first?.id ? [first.id, ...ids] : ids;
  result.notes.push(`Tab 序列：${observed.map((item) => item.id || item.label || item.tag).join(' → ')}`);
  let cursor = -1;
  let orderCorrect = true;
  for (const id of expectedIds) {
    const position = sequence.indexOf(id, cursor + 1);
    if (position === -1) {
      orderCorrect = false;
      break;
    }
    cursor = position;
  }
  result.checks.orderCorrect = orderCorrect;
  if (!orderCorrect) addScenarioIssue(result, `Tab 顺序未按预期经过 ${expectedIds.join(' → ')}`);
  result.checks.submitReachable = observed.some(
    (item) => item.type === 'submit' || /提交/.test(item.label),
  );
  if (!result.checks.submitReachable) addScenarioIssue(result, 'Tab 无法到达提交按钮');
  result.status = result.issues.length ? 'fail' : 'pass';
  return result;
}

const INTERACTION_MATRIX = {
  'admin-dashboard': [
    { scenario: 'command-palette', runner: runPaletteInteraction },
    { scenario: 'dialog（? 快捷键帮助）', runner: runKeyboardModalInteraction },
  ],
  'admin-feedback': [
    {
      scenario: 'popover（保存视图：Esc + 焦点恢复）',
      runner: runPopoverInteraction,
      options: { triggerAriaLabel: '保存当前筛选为视图', popoverSelector: 'input[aria-label="视图名称"]' },
    },
    {
      scenario: 'dialog（导入 CSV）',
      runner: runDialogInteraction,
      options: { triggerText: '导入 CSV', dialogLabelIncludes: '导入反馈 CSV' },
    },
  ],
  'admin-feedback-detail': [
    {
      scenario: 'dialog（编辑反馈）',
      runner: runDialogInteraction,
      options: { triggerText: '编辑', dialogLabelIncludes: '编辑反馈' },
    },
    {
      scenario: 'dialog（合并反馈）',
      runner: runDialogInteraction,
      options: { triggerText: '合并到其他反馈', dialogLabelIncludes: '合并反馈', optional: true },
    },
  ],
  'admin-notifications': [
    { scenario: 'dialog（按钮触发：清空全部）', runner: runButtonModalInteraction },
    { scenario: 'dialog（? 快捷键帮助）', runner: runKeyboardModalInteraction },
  ],
  'admin-notification-preferences': [
    {
      scenario: 'switch（偏好开关键盘可达 + Space 切换）',
      runner: runSwitchInteraction,
      options: {
        selector: '[role="switch"]',
        emptyReason: '项目暂无通知偏好数据（偏好卡未渲染），数据存在时该场景自动启用',
      },
    },
  ],
  'board-home': [
    {
      scenario: 'dialog（提交反馈 SubmitModal）',
      runner: runDialogInteraction,
      options: { triggerText: '提交反馈', dialogLabelIncludes: '提交' },
    },
  ],
  submit: [
    {
      scenario: 'Tab 顺序（提交表单）',
      runner: runTabOrderInteraction,
      options: { expectedIds: ['feedback-title', 'feedback-content', 'feedback-contact'], maxTabs: 20 },
    },
  ],
};

async function runInteractionScenario(session, descriptor) {
  try {
    return await descriptor.runner(session, descriptor.options ?? {});
  } catch (error) {
    const message = `场景执行异常：${error instanceof Error ? error.message : String(error)}`;
    return {
      scenario: descriptor.scenario,
      status: 'fail',
      checks: {},
      notes: [],
      issues: [{ severity: 'serious', category: 'interaction', message, selector: '', snippet: '' }],
    };
  }
}

// ---------------------------------------------------------------------------
// 审计执行
// ---------------------------------------------------------------------------
async function auditPage(client, browserContextId, page, options, auth, adminOrigin, theme = 'light') {
  const session = new PageSession(client);
  const result = {
    page: { key: page.key, label: page.label, url: page.url ?? '' },
    theme,
    ok: false,
    error: null,
    audit: null,
    focus: null,
    themeFallback: false,
    themeDetected: null,
    themeSupported: theme === 'light',
  };
  try {
    await session.init({ browserContextId, viewport: VIEWPORT, colorScheme: theme });
    await session.addInitScript(buildThemeInitScript(adminOrigin, page.auth ? auth : null, theme));
    const loaded = await session.navigate(page.url);
    if (!loaded) throw new Error('页面 load 事件超时（30s）');
    const ready = await session.waitUntil(page.ready, { timeoutMs: 10000 });
    await sleep(700);

    // 校验并兜底应用主题（admin 在 React mount 后加 class，board 由内联脚本提前加）
    const themeState = await session.evaluate(`(() => {
      const root = document.documentElement;
      const body = document.body;
      const wasDark = root.classList.contains('dark');
      const background = () => {
        const bodyColor = body ? getComputedStyle(body).backgroundColor : '';
        return bodyColor + '|' + getComputedStyle(root).backgroundColor;
      };
      root.classList.add('dark');
      const darkBackground = background();
      root.classList.remove('dark');
      const lightBackground = background();
      if (wasDark) root.classList.add('dark');
      return {
        dark: wasDark,
        stored: localStorage.getItem('theme'),
        themeStyleDetected: darkBackground !== lightBackground,
      };
    })()`);
    const wantDark = theme === 'dark';
    if (wantDark && !themeState.dark) {
      await session.evaluate(
        `(() => { document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = 'dark'; return true; })()`,
      );
      result.themeFallback = true;
    } else if (!wantDark && themeState.dark) {
      await session.evaluate(
        `(() => { document.documentElement.classList.remove('dark'); document.documentElement.style.colorScheme = 'light'; return true; })()`,
      );
      result.themeFallback = true;
    }
    result.themeDetected = themeState;
    result.themeSupported = theme === 'light' ? true : themeState.themeStyleDetected;
    await sleep(700);

    result.ready = ready || (await session.waitUntil(page.ready, { timeoutMs: 3000 }));
    if (page.interactionOnly) {
      // 仅交互探测页（如 admin 详情）：不把页面级 DOM/标签问题混入常规审计基线。
      result.audit = null;
      result.focus = null;
      result.auditSkipped = '仅键盘交互探测，不参与常规 DOM/焦点审计';
    } else {
      result.audit = await session.evaluate(`(${pageAudit.toString()})()`);

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
    }

    // ---- 键盘交互检查（--interactions）----
    if (options.interactions) {
      const scenarios = [];
      const plan = INTERACTION_MATRIX[page.key] ?? [];
      for (const descriptor of plan) {
        scenarios.push(await runInteractionScenario(session, descriptor));
      }
      result.interactions = { enabled: true, scenarios };
    } else {
      result.interactions = null;
    }
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
  const interactionIssues = [];
  if (result.interactions?.scenarios) {
    for (const scenario of result.interactions.scenarios) {
      for (const issue of scenario.issues ?? []) interactionIssues.push(issue);
    }
  }
  all.push(...interactionIssues);
  return {
    counts: severityCounts(all),
    total: all.length,
    violations: all,
    stats: result.audit?.stats ?? null,
    focus: result.focus,
    interactions: result.interactions,
  };
}

function buildMarkdown(report) {
  const lines = [];
  const themes = report.environment.themes ?? [];
  const multiTheme = themes.length > 1;
  lines.push('# Nexus Feedback 无障碍（a11y）审计报告');
  lines.push('');
  lines.push(`- 生成时间：${report.generatedAt}`);
  lines.push(`- Chrome：CDP ${report.environment.chromePort}（${report.environment.chromeReused ? '复用已运行实例' : '脚本自动启动 headless'}）`);
  lines.push(
    `- 主题：${report.environment.theme === 'both' ? 'light + dark（两套）' : report.environment.theme}；视口：${report.environment.viewport.width}×${report.environment.viewport.height}`,
  );
  lines.push(`- 页面：${report.environment.baseAdmin} / ${report.environment.baseBoard} / ${report.environment.baseSubmit} / API ${report.environment.baseApi}`);
  if (report.environment.interactions) {
    lines.push('- 键盘交互：已启用（场景矩阵：命令面板 / dialog 焦点陷阱·Esc·焦点恢复 / popover / Switch / 表单 Tab 顺序）');
  }
  lines.push('- 说明：DOM 级近似审计（可访问名称/标签/ARIA/对比度为近似实现），对比度按 computed color 与其祖先背景色计算；');
  lines.push('  默认只做报告，使用 `--fail-on`（或 `pnpm a11y:check`）可启用质量门禁，见下方「门禁」。');
  lines.push('');
  lines.push('## 汇总');
  lines.push('');
  lines.push(
    `| 页面 | ${multiTheme ? '主题 | ' : ''}严重 | 中等 | 轻微 | 对比度问题 | 可聚焦元素 | Tab 步数 | 判定 |`,
  );
  lines.push(`|---|${multiTheme ? '---|' : ''}---|---|---|---|---|---|---|`);
  for (const page of report.pages) {
    const themeCell = multiTheme ? `${themeLabel(page.theme)} | ` : '';
    if (!page.ok) {
      lines.push(`| ${page.page.label} | ${themeCell}- | - | - | - | - | - | ❌ 采集失败 |`);
      continue;
    }
    const s = page.summary;
    const verdict = s.counts.serious > 0 ? '❌ FAIL（严重）' : s.counts.moderate > 0 ? '⚠️ WARN（中等）' : '✅ PASS';
    lines.push(
      `| ${page.page.label} | ${themeCell}${s.counts.serious} | ${s.counts.moderate} | ${s.counts.minor} | ` +
        `${page.summary.stats?.contrastViolations ?? 0} | ${page.summary.stats?.focusableCount ?? 0} | ` +
        `${page.summary.focus?.tabSteps ?? 0} | ${verdict} |`,
    );
  }
  lines.push('');
  const interactionPages = report.pages.filter(
    (page) => page.interactions?.enabled && (page.interactions.scenarios?.length ?? 0) > 0,
  );
  if (interactionPages.length) {
    lines.push('## 键盘交互');
    lines.push('');
    lines.push(
      `| 页面 | ${multiTheme ? '主题 | ' : ''}场景 | 检查项 | 结论 |`,
    );
    lines.push(`|---|${multiTheme ? '---|' : ''}---|---|---|`);
    const mark = (value) => (value === undefined ? '—' : value ? '✅' : '❌');
    const scenarioStatus = (scenario) =>
      scenario.status === 'skip' ? '⏭️ SKIP' : scenario.status === 'pass' ? '✅ PASS' : '❌ FAIL';
    for (const page of interactionPages) {
      for (const scenario of page.interactions.scenarios) {
        const checks = scenario.checks ?? {};
        const checkText = Object.entries(checks)
          .map(([key, value]) => `${key} ${mark(value)}`)
          .join('；');
        lines.push(
          `| ${page.page.label} | ${multiTheme ? `${themeLabel(page.theme)} | ` : ''}${scenario.scenario} | ` +
            `${checkText || '—'} | ${scenarioStatus(scenario)} |`,
        );
      }
    }
    lines.push('');
    const failedScenarios = interactionPages.flatMap((page) =>
      (page.interactions.scenarios ?? [])
        .filter((scenario) => scenario.status === 'fail')
        .map((scenario) => ({ page, scenario })),
    );
    if (failedScenarios.length) {
      lines.push('问题明细：');
      lines.push('');
      for (const { page, scenario } of failedScenarios) {
        lines.push(`- ${page.page.label} · ${scenario.scenario}`);
        for (const issue of scenario.issues ?? []) lines.push(`  - ${issue.message}`);
      }
      lines.push('');
    }
    const skippedScenarios = interactionPages.flatMap((page) =>
      (page.interactions.scenarios ?? [])
        .filter((scenario) => scenario.status === 'skip')
        .map((scenario) => ({ page, scenario })),
    );
    for (const { page, scenario } of skippedScenarios) {
      lines.push(`- ⏭️ ${page.page.label} · ${scenario.scenario}：${scenario.reason ?? '跳过'}`);
    }
    if (skippedScenarios.length) lines.push('');
  }
  const gate = report.gate;
  if (gate) {
    lines.push('## 门禁');
    lines.push('');
    const modeLabel =
      gate.failOn === 'none'
        ? '未启用（--fail-on=none）'
        : gate.failOn === 'serious'
          ? '--fail-on=serious（存在严重即失败）'
          : `--fail-on=medium（每个主题允许中等 ≤ ${gate.maxMedium}）`;
    const statusLabel = gate.status === 'disabled' ? '未启用' : gate.status === 'pass' ? '✅ PASS' : '❌ FAIL';
    lines.push(`- 模式：${modeLabel}`);
    lines.push(`- 结果：${statusLabel}（退出码 ${gate.exitCode}）`);
    lines.push(`- 计数：严重 ${gate.totals.serious} / 中等 ${gate.totals.moderate} / 轻微 ${gate.totals.minor}`);
    if (gate.perTheme) {
      for (const theme of Object.keys(gate.perTheme)) {
        const counts = gate.perTheme[theme];
        lines.push(
          `- ${themeLabel(theme)}主题合计：严重 ${counts.serious} / 中等 ${counts.moderate} / 轻微 ${counts.minor}`,
        );
      }
    }
    if (gate.reasons.length) {
      lines.push('- 原因：');
      for (const reason of gate.reasons) lines.push(`  - ${reason}`);
    }
    if (gate.failedPages.length) lines.push(`- 超阈值页面：${gate.failedPages.join('、')}`);
    lines.push('');
    lines.push('| 页面 | 严重 | 中等 | 轻微 |');
    lines.push('|---|---|---|---|');
    for (const page of gate.perPage) {
      if (!page.ok) {
        lines.push(`| ${page.label} | - | - | - |`);
        continue;
      }
      lines.push(`| ${page.label} | ${page.serious} | ${page.moderate} | ${page.minor} |`);
    }
    lines.push('');
  }

  const pushPageDetail = (page, heading) => {
    lines.push(`${heading} ${page.page.label}`);
    lines.push('');
    if (!page.ok) {
      lines.push(`- ❌ 采集失败：${page.error}`);
      lines.push('');
      return;
    }
    if (!page.summary.violations.length) {
      lines.push('- 未发现问题。');
      lines.push('');
      return;
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
  };

  lines.push('## 问题明细');
  lines.push('');
  if (multiTheme) {
    for (const theme of themes) {
      lines.push(`### ${themeLabel(theme)}主题（${theme}）`);
      lines.push('');
      for (const page of report.pages.filter((entry) => entry.theme === theme)) {
        pushPageDetail(page, '####');
      }
    }
  } else {
    for (const page of report.pages) pushPageDetail(page, '###');
  }

  if (report.environment.theme === 'both') {
    lines.push('## 暗色专属问题');
    lines.push('');
    const darkOnly = report.darkOnlyIssues ?? [];
    if (!darkOnly.length) {
      lines.push('- 未发现暗色专属问题（暗色结果与亮色基线一致）。');
      lines.push('');
    } else {
      lines.push(`共 ${darkOnly.length} 条（暗色出现、亮色不存在的违规），按严重→中等排序：`);
      lines.push('');
      lines.push('| 页面 | 级别 | 类别 | 说明 | 选择器 |');
      lines.push('|---|---|---|---|---|');
      for (const issue of darkOnly) {
        lines.push(
          `| ${issue.page} | ${SEVERITY_LABELS[issue.severity]} | ${CATEGORY_LABELS[issue.category] ?? issue.category} | ` +
            `${String(issue.message).replace(/\|/g, '\\|')} | ${String(issue.selector || issue.snippet || '').replace(/\|/g, '\\|')} |`,
        );
      }
      lines.push('');
    }
  }

  lines.push('## 复跑方式');
  lines.push('');
  lines.push('```bash');
  lines.push('pnpm a11y                              # 仅报告（亮色）');
  lines.push('pnpm a11y:check                        # 质量门禁（存在严重则 exit 1）');
  lines.push('node scripts/a11y.mjs --theme=both --fail-on=none    # 亮色 + 暗色基线');
  lines.push('node scripts/a11y.mjs --theme=dark --only=board-home');
  lines.push('node scripts/a11y.mjs --fail-on=medium --max-medium=2 --only=admin-login');
  lines.push('```');
  lines.push('');
  lines.push('JSON 报告包含每个问题的选择器、片段、对比度数值与完整明细；`pages[].theme` 标明主题。');
  lines.push('');
  return lines.join('\n');
}

function issueKey(violation) {
  return `${violation.severity}|${violation.category}|${violation.selector}|${violation.snippet ?? ''}`;
}

/** 暗色专属问题：同一页面在暗色下出现、亮色下不存在的违规（排序列严重→中等→轻微）。 */
function collectDarkOnlyIssues(pages) {
  const lightPages = new Map(pages.filter((entry) => entry.theme === 'light').map((entry) => [entry.page.key, entry]));
  const issues = [];
  for (const darkPage of pages.filter((entry) => entry.theme === 'dark' && entry.ok)) {
    const lightPage = lightPages.get(darkPage.page.key);
    const lightKeys = new Set();
    if (lightPage?.ok) {
      for (const violation of lightPage.summary.violations) lightKeys.add(issueKey(violation));
    }
    for (const violation of darkPage.summary.violations) {
      if (lightKeys.has(issueKey(violation))) continue;
      issues.push({
        page: darkPage.page.label,
        pageKey: darkPage.page.key,
        severity: violation.severity,
        category: violation.category,
        message: violation.message,
        selector: violation.selector,
        snippet: violation.snippet,
        extra: violation.extra ?? null,
        darkOnly: true,
      });
    }
  }
  const order = { serious: 0, moderate: 1, minor: 2 };
  return issues.sort(
    (a, b) =>
      (order[a.severity] ?? 3) - (order[b.severity] ?? 3) ||
      String(a.page).localeCompare(String(b.page)) ||
      String(a.selector).localeCompare(String(b.selector)),
  );
}

function buildGate(pages, options) {
  const multiTheme = options.theme === 'both';
  const perPage = pages.map((entry) => ({
    key: entry.page.key,
    label: multiTheme ? `${entry.page.label}（${themeLabel(entry.theme)}）` : entry.page.label,
    theme: entry.theme,
    url: entry.page.url,
    ok: entry.ok,
    error: entry.error ?? null,
    serious: entry.ok ? entry.summary.counts.serious : null,
    moderate: entry.ok ? entry.summary.counts.moderate : null,
    minor: entry.ok ? entry.summary.counts.minor : null,
  }));
  const totals = { serious: 0, moderate: 0, minor: 0 };
  const themes = multiTheme ? ['light', 'dark'] : [options.theme];
  const perTheme = multiTheme ? Object.fromEntries(themes.map((theme) => [theme, { serious: 0, moderate: 0, minor: 0 }])) : null;
  for (const page of perPage) {
    if (!page.ok) continue;
    totals.serious += page.serious;
    totals.moderate += page.moderate;
    totals.minor += page.minor;
    if (perTheme && perTheme[page.theme]) {
      perTheme[page.theme].serious += page.serious;
      perTheme[page.theme].moderate += page.moderate;
      perTheme[page.theme].minor += page.minor;
    }
  }

  const enabled = options.failOn !== 'none';
  const allowedMedium = options.failOn === 'medium' ? (options.maxMedium ?? 0) : null;
  const reasons = [];
  const collectionErrors = perPage.filter((page) => !page.ok).map((page) => `${page.label}：${page.error ?? '采集失败'}`);
  const themeChecks = (multiTheme ? themes : [null]).map((theme) => {
    if (theme) return { theme, counts: perTheme[theme] };
    return { theme: null, counts: totals };
  });
  if (enabled) {
    if (collectionErrors.length) reasons.push(`页面采集失败：${collectionErrors.join('；')}`);
    for (const check of themeChecks) {
      const prefix = check.theme ? `（${themeLabel(check.theme)}）` : '';
      if (check.counts.serious > 0) reasons.push(`严重问题${prefix} ${check.counts.serious} > 允许上限 0`);
      if (options.failOn === 'medium' && check.counts.moderate > allowedMedium) {
        reasons.push(`中等问题${prefix} ${check.counts.moderate} > 允许上限 ${allowedMedium}`);
      }
    }
  }
  const status = !enabled ? 'disabled' : reasons.length ? 'fail' : 'pass';
  const failedPages =
    enabled && status === 'fail'
      ? perPage
          .filter(
            (page) =>
              !page.ok ||
              (page.serious ?? 0) > 0 ||
              (options.failOn === 'medium' && (page.moderate ?? 0) > 0),
          )
          .map((page) => page.label)
      : [];

  return {
    enabled,
    failOn: options.failOn,
    maxMedium: allowedMedium,
    themes: multiTheme ? themes : null,
    perTheme,
    status,
    exitCode: status === 'fail' ? 1 : 0,
    totals,
    perPage,
    reasons,
    failedPages,
  };
}

function printGate(gate) {
  const themeSummary = () => {
    if (!gate.perTheme) return;
    for (const theme of Object.keys(gate.perTheme)) {
      const counts = gate.perTheme[theme];
      console.log(`  ${themeLabel(theme)}：严重 ${counts.serious} / 中等 ${counts.moderate} / 轻微 ${counts.minor}`);
    }
  };
  if (!gate.enabled) {
    console.log('门禁：未启用（--fail-on=none，仅输出报告）');
    console.log(`  计数：严重 ${gate.totals.serious} / 中等 ${gate.totals.moderate} / 轻微 ${gate.totals.minor}`);
    themeSummary();
    return;
  }
  const label =
    gate.failOn === 'serious'
      ? '--fail-on=serious（存在严重即失败）'
      : `--fail-on=medium（允许中等 ≤ ${gate.maxMedium}）`;
  console.log(`门禁：${gate.status === 'pass' ? 'PASS' : 'FAIL'}（${label}）`);
  console.log(`  计数：严重 ${gate.totals.serious} / 中等 ${gate.totals.moderate} / 轻微 ${gate.totals.minor}`);
  themeSummary();
  console.log('  各页计数：');
  for (const page of gate.perPage) {
    const counts = page.ok
      ? `严重 ${page.serious} / 中等 ${page.moderate} / 轻微 ${page.minor}`
      : `采集失败（${page.error ?? '未知错误'}）`;
    console.log(`    ${padCell(page.label, gate.perTheme ? 26 : 22)} ${counts}`);
  }
  if (gate.reasons.length) {
    console.log('  原因：');
    for (const reason of gate.reasons) console.log(`    - ${reason}`);
  }
  if (gate.failedPages.length) console.log(`  超阈值页面：${gate.failedPages.join('、')}`);
  console.log(`  退出码：${gate.exitCode}`);
}

function printConsoleTable(report) {
  const multiTheme = (report.environment.themes?.length ?? 0) > 1;
  const headers = ['页面', ...(multiTheme ? ['主题'] : []), '严重', '中等', '轻微', '对比度', '可聚焦', 'Tab', '判定'];
  const widths = [20, ...(multiTheme ? [6] : []), 5, 5, 5, 7, 7, 5, 16];
  const row = (cells) => cells.map((cell, index) => padCell(cell, widths[index])).join('');
  console.log('');
  console.log(headers.map((header, index) => padCell(header, widths[index])).join(''));
  console.log(widths.map((width) => '-'.repeat(width)).join(''));
  for (const page of report.pages) {
    if (!page.ok) {
      console.log(
        row(['采集失败', ...(multiTheme ? [themeLabel(page.theme)] : []), '-', '-', '-', '-', '-', '-', 'FAIL']),
      );
      continue;
    }
    const s = page.summary;
    const verdict = s.counts.serious > 0 ? 'FAIL（严重）' : s.counts.moderate > 0 ? 'WARN（中等）' : 'PASS';
    console.log(
      row([
        page.page.label,
        ...(multiTheme ? [themeLabel(page.theme)] : []),
        String(s.counts.serious),
        String(s.counts.moderate),
        String(s.counts.minor),
        String(page.summary.stats?.contrastViolations ?? 0),
        String(page.summary.stats?.focusableCount ?? 0),
        String(page.summary.focus?.tabSteps ?? 0),
        verdict,
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`参数错误：${error instanceof Error ? error.message : error}`);
    return 1;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const startedAt = new Date();
  console.log('Nexus Feedback 无障碍（a11y）审计（CDP）');
  console.log(
    `admin=${options.baseAdmin}  board=${options.baseBoard}  submit=${options.baseSubmit}  api=${options.baseApi}`,
  );
  console.log(
    `主题：${options.theme === 'both' ? 'light + dark（两套）' : options.theme}；视口：${VIEWPORT.width}×${VIEWPORT.height}；` +
      '页面：submit / board 首页+详情 / admin 登录+dashboard+feedback+notifications',
  );

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
    const adminFeedbackId = await resolveAdminFeedbackId(options, auth);
    console.log(adminFeedbackId ? `admin feedback 详情 ID：${adminFeedbackId}` : '⚠️ 未能获取 admin feedback ID，跳过详情页交互');
    const demoProjectId = await resolveDemoProjectId(options, auth);
    console.log(demoProjectId ? `demo 项目 ID：${demoProjectId}` : '⚠️ 未能获取 demo 项目 ID，跳过通知偏好页交互');

    const pageList = buildPages(options, detailUrl, adminFeedbackId, demoProjectId).filter((page) => {
      if (!options.only) return true;
      return options.only.split(',').map((key) => key.trim()).filter(Boolean).includes(page.key);
    });
    if (!pageList.length) throw new Error(`--only 未匹配到页面：${options.only}`);
    const themes = options.theme === 'both' ? ['light', 'dark'] : [options.theme];
    const multiTheme = themes.length > 1;
    for (const theme of themes) {
      if (multiTheme) console.log(`\n══ 主题：${themeLabel(theme)}（${theme}）══`);
      for (const page of pageList) {
        if (page.unavailableReason) {
          pages.push({
            page: { key: page.key, label: page.label, url: page.url ?? '' },
            theme,
            ok: false,
            error: page.unavailableReason,
            audit: null,
            focus: null,
            themeFallback: false,
            themeDetected: null,
            themeSupported: theme === 'light',
            summary: { counts: { serious: 0, moderate: 0, minor: 0 }, total: 0, violations: [], stats: null, focus: null },
          });
          continue;
        }
        const { browserContextId } = await client.send('Target.createBrowserContext', {});
        browserContexts.push(browserContextId);
        console.log(`\n▶ 审计 ${page.label}${multiTheme ? ` · ${themeLabel(theme)}` : ''}`);
        const result = await auditPage(client, browserContextId, page, options, auth, adminOrigin, theme);
        await client.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
        browserContexts.pop();
        const summary = summarizePage(result);
        pages.push({ ...result, theme, summary });
        if (result.ok) {
          const notes = [];
          if (theme === 'dark' && result.themeSupported === false) notes.push('该页面未声明暗色样式');
          if (result.themeFallback) notes.push('主题由脚本兜底应用');
          console.log(
            `  完成：严重 ${summary.counts.serious} / 中等 ${summary.counts.moderate} / 轻微 ${summary.counts.minor}；` +
              `对比度问题 ${summary.stats?.contrastViolations ?? 0}；Tab ${summary.focus?.tabSteps ?? 0} 步` +
              `${notes.length ? `（${notes.join('；')}）` : ''}`,
          );
        } else {
          console.log(`  失败：${result.error}`);
        }
      }
    }

    const gate = buildGate(pages, options);
    const darkOnlyIssues = options.theme === 'both' ? collectDarkOnlyIssues(pages) : [];
    const report = {
      generatedAt: startedAt.toISOString(),
      environment: {
        chromePort: options.chromePort,
        chromeReused,
        viewport: VIEWPORT,
        theme: options.theme,
        themes,
        interactions: options.interactions,
        baseAdmin: options.baseAdmin,
        baseBoard: options.baseBoard,
        baseSubmit: options.baseSubmit,
        baseApi: options.baseApi,
        failOn: options.failOn,
        maxMedium: options.maxMedium,
      },
      gate,
      darkOnlyIssues,
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
    console.log(`合计：严重 ${gate.totals.serious} / 中等 ${gate.totals.moderate} / 轻微 ${gate.totals.minor}`);
    if (options.theme === 'both') {
      const label = darkOnlyIssues.length ? `${darkOnlyIssues.length} 条（详见报告）` : '0 条';
      console.log(`暗色专属问题：${label}`);
    }
    if (options.interactions) {
      const scenarios = pages.flatMap((page) =>
        (page.interactions?.scenarios ?? []).map((scenario) => ({
          ...scenario,
          pageLabel: page.page.label,
          pageTheme: page.theme,
        })),
      );
      const failed = scenarios.filter((scenario) => scenario.status === 'fail');
      const skipped = scenarios.filter((scenario) => scenario.status === 'skip');
      console.log(
        `键盘交互：${scenarios.length} 个场景，PASS ${scenarios.length - failed.length - skipped.length} / FAIL ${failed.length} / SKIP ${skipped.length}`,
      );
      for (const scenario of failed) {
        console.log(`  ❌ ${scenario.pageLabel}${scenario.pageTheme ? `（${themeLabel(scenario.pageTheme)}）` : ''} · ${scenario.scenario}`);
        for (const issue of scenario.issues ?? []) console.log(`     - ${issue.message}`);
      }
      for (const scenario of skipped) {
        console.log(
          `  ⏭️ ${scenario.pageLabel}${scenario.pageTheme ? `（${themeLabel(scenario.pageTheme)}）` : ''} · ${scenario.scenario}：${scenario.reason ?? '跳过'}`,
        );
      }
    }
    printGate(gate);
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

    return gate.exitCode;
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

export { buildGate };

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
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
}