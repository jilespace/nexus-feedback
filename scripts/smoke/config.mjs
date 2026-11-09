/** 冒烟脚本的共享常量与页面表达式。 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SHOT_DIR = path.join(ROOT, '.tools', 'shots', 'smoke');

export const DEMO_API_KEY = 'nf_demo_project_key_789';
export const DEMO_PROJECT_SLUG = 'demo-project';
export const DEMO_PROJECT_ID = 'cms3916d60003v5m8fk4x7bpg';
export const LOGIN = { email: 'admin@nexus.dev', password: 'admin123', org_slug: 'demo' };

export const WIDGET_DEMO_SERVER = path.join(ROOT, 'packages', 'widget', 'demo', 'server.mjs');
export const WIDGET_DIST_IIFE = path.join(
  ROOT,
  'packages',
  'widget',
  'dist',
  'nexus-feedback-widget.iife.js',
);
export const WIDGET_DEMO_ORIGIN = 'http://127.0.0.1:8099';
export const WIDGET_DEMO_URL = `${WIDGET_DEMO_ORIGIN}/demo/`;

export const ADMIN_READY = `(document.querySelector('main')?.innerText.trim().length ?? 0) > 20`;

export const INFO_EXPR = `(() => {
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
