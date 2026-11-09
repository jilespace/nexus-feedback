/** 断言、文本排版与 HTTP 小工具。 */
import { setTimeout as sleep } from 'node:timers/promises';

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function truncate(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function displayWidth(text) {
  let width = 0;
  for (const char of String(text)) {
    width += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(
      char,
    )
      ? 2
      : 1;
  }
  return width;
}

export function padCell(text, width) {
  const value = truncate(String(text ?? ''), 200);
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
}

export async function httpJson(url, init = {}, timeoutMs = 15000) {
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

export async function waitForHttp(url, timeoutMs = 12000) {
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
