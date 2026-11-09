#!/usr/bin/env node
/**
 * Widget demo 宿主页服务器（零依赖）。
 *
 * 暴露 packages/widget 目录（demo/ 宿主页 + dist/ 构建产物），并把 /api/* 代理到本地 API，
 * 让 Widget 与 API 同源，避免 CORS 配置。
 *
 * 用法：
 *   pnpm --filter @nexus-feedback/widget build   # 先生成 dist/nexus-feedback-widget.iife.js
 *   node packages/widget/demo/server.mjs [--port=8099]
 *
 * 打开：http://localhost:8099/demo/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEMO_DIR = path.dirname(fileURLToPath(import.meta.url));
const WIDGET_ROOT = path.resolve(DEMO_DIR, '..');
const API_ORIGIN = (process.env.API_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');

function parsePort(argv) {
  const fromFlag = argv.find((arg) => arg.startsWith('--port='))?.split('=')[1];
  if (fromFlag !== undefined) {
    const port = Number(fromFlag);
    if (!Number.isInteger(port) || port <= 0) throw new Error(`无效的 --port: ${fromFlag}`);
    return port;
  }
  const fromEnv = Number(process.env.PORT);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : 8099;
}

const port = parsePort(process.argv.slice(2));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function resolveStaticPath(pathname) {
  // 只暴露 demo 与 dist 两个目录，避免把 src / node_modules 也静态暴露出去。
  const baseDir = pathname.startsWith('/dist/')
    ? path.join(WIDGET_ROOT, 'dist')
    : pathname.startsWith('/demo/')
      ? DEMO_DIR
      : null;
  if (!baseDir) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const filePath = path.resolve(WIDGET_ROOT, `.${decoded}`);
  if (filePath !== baseDir && !filePath.startsWith(`${baseDir}${path.sep}`)) return null;
  return filePath;
}

function serveStatic(res, filePath) {
  let target = filePath;
  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    const data = fs.readFileSync(target);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

async function proxyApi(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const headers = {};
    for (const key of ['content-type', 'accept', 'x-api-key', 'authorization', 'cookie']) {
      const value = req.headers[key];
      if (typeof value === 'string') headers[key] = value;
    }
    const origin = `http://${req.headers.host ?? `localhost:${port}`}`;
    const upstream = await fetch(`${API_ORIGIN}${req.url}`, {
      method: req.method,
      headers: { ...headers, origin },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      signal: AbortSignal.timeout(15000),
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    const responseHeaders = {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) responseHeaders['Set-Cookie'] = setCookie;
    res.writeHead(upstream.status, responseHeaders);
    res.end(payload);
  } catch (error) {
    sendJson(res, 502, { code: 50200, data: null, message: `API 代理失败: ${String(error)}` });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    void proxyApi(req, res);
    return;
  }

  if (pathname === '/' || pathname === '/demo') {
    res.writeHead(302, { Location: '/demo/' });
    res.end();
    return;
  }

  if (pathname === '/demo/') {
    serveStatic(res, path.join(DEMO_DIR, 'index.html'));
    return;
  }

  const filePath = resolveStaticPath(pathname);
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }
  serveStatic(res, filePath);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Widget demo: http://localhost:${port}/demo/`);
  console.log(`API proxy:   ${API_ORIGIN}/api/*`);
  if (!fs.existsSync(path.join(WIDGET_ROOT, 'dist', 'nexus-feedback-widget.iife.js'))) {
    console.warn('⚠️  dist/nexus-feedback-widget.iife.js 不存在，请先运行 pnpm --filter @nexus-feedback/widget build');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
