import { useEffect } from 'react';

export interface PageMeta {
  title: string;
  description: string;
  /** Used for `og:site_name`, usually the public project name. */
  siteName: string;
  /** Route path relative to the origin; defaults to the current pathname. */
  path?: string;
  type?: 'website' | 'article';
  /** Structured data for the current route; `null` removes it. */
  jsonLd?: Record<string, unknown> | null;
}

const JSON_LD_ID = 'board-jsonld';

/** Absolute, slash-normalized URL so canonical / og:url stay stable. */
export function canonicalUrl(path?: string): string {
  const pathname = path ?? window.location.pathname;
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return `${window.location.origin}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

/** Truncate by code points so CJK titles and emoji are not split. */
export function truncateText(text: string, max: number): string {
  const chars = Array.from(text.trim());
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
}

/** Single-line excerpt for meta descriptions. */
export function excerpt(text: string, max: number): string {
  return truncateText(text.replace(/\s+/g, ' '), max);
}

function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
): void {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function setJsonLd(serialized: string | null): void {
  const existing = document.getElementById(JSON_LD_ID);
  if (serialized === null) {
    existing?.remove();
    return;
  }
  const script =
    existing instanceof HTMLScriptElement
      ? existing
      : document.createElement('script');
  if (!(existing instanceof HTMLScriptElement)) {
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = serialized;
}

export function applyPageMeta(meta: {
  title: string;
  description: string;
  siteName: string;
  url: string;
  type: string;
}): void {
  document.title = meta.title;
  upsertMeta('name', 'description', meta.description);
  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('property', 'og:url', meta.url);
  upsertMeta('property', 'og:type', meta.type);
  upsertMeta('property', 'og:site_name', meta.siteName);
  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', meta.description);
  upsertCanonical(meta.url);
}

/**
 * Keeps document.title, meta description, canonical, Open Graph / Twitter tags
 * and an optional JSON-LD block in sync with the current route.
 * Tags are upserted by selector, so repeated calls never duplicate nodes.
 */
export function usePageMeta({
  title,
  description,
  siteName,
  path,
  type = 'website',
  jsonLd = null,
}: PageMeta): void {
  const url = canonicalUrl(path);
  const serializedJsonLd = jsonLd === null ? null : JSON.stringify(jsonLd);

  useEffect(() => {
    applyPageMeta({ title, description, siteName, url, type });
  }, [title, description, siteName, url, type]);

  useEffect(() => {
    setJsonLd(serializedJsonLd);
    return () => {
      setJsonLd(null);
    };
  }, [serializedJsonLd]);
}
