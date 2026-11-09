/** Chrome 启动/清理、最小 CDP 客户端与页面会话封装（零依赖）。 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { ROOT, SHOT_DIR } from './config.mjs';

export const chromeCommand = {
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

export class CdpClient {
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

export class PageSession {
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

export function diagnosticsSummary(page) {
  const { consoleErrors, exceptions, logErrors, networkFailures } = page.diagnostics;
  const parts = [];
  if (consoleErrors.length) parts.push(`console errors: ${consoleErrors.length}`);
  if (exceptions.length) parts.push(`exceptions: ${exceptions.length}`);
  if (logErrors.length) parts.push(`log errors: ${logErrors.length}`);
  if (networkFailures.length) parts.push(`network failures: ${networkFailures.length}`);
  return parts.join(', ');
}

/** 兜底：异常退出时也尽量回收本脚本启动的 headless Chrome。 */
export function registerExitCleanup() {
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
}
