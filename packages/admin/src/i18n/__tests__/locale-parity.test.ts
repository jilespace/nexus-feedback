import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../locales');
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

function flatten(value: Json, prefix = '', out: Record<string, string> = {}) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child as Json, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

function load(language: string) {
  const files: Array<[string, string]> = [];
  const rootFile = path.join(localesDir, `${language}.json`);
  if (fs.existsSync(rootFile)) files.push(['translation', rootFile]);

  const languageDir = path.join(localesDir, language);
  if (fs.existsSync(languageDir)) {
    for (const file of fs.readdirSync(languageDir)) {
      if (!file.endsWith('.json')) continue;
      files.push([path.basename(file, '.json'), path.join(languageDir, file)]);
    }
  }

  return new Map(
    files.map(([namespace, file]) => [
      namespace,
      flatten(JSON.parse(fs.readFileSync(file, 'utf8')) as Json),
    ]),
  );
}

function baseKey(key: string): string {
  return key.replace(PLURAL_SUFFIX, '');
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]!).sort();
}

/** All keys in `keys` that belong to `key` (base key or one of its plural forms). */
function variantsOf(key: string, keys: Record<string, string>): string[] {
  return Object.keys(keys).filter((candidate) => baseKey(candidate) === baseKey(key));
}

describe('locale files', () => {
  const zh = load('zh');
  const en = load('en');

  it('exposes the same namespaces for zh and en', () => {
    expect([...zh.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('keeps the same translation keys per namespace (plural variants allowed)', () => {
    for (const [namespace, zhKeys] of zh) {
      const enKeys = en.get(namespace)!;
      const zhBases = new Set(Object.keys(zhKeys).map(baseKey));
      const enBases = new Set(Object.keys(enKeys).map(baseKey));
      expect([...enBases].sort(), `namespace ${namespace}`).toEqual([...zhBases].sort());
    }
  });

  it('uses matching interpolation placeholders', () => {
    for (const [namespace, zhKeys] of zh) {
      const enKeys = en.get(namespace)!;
      for (const [key, zhValue] of Object.entries(zhKeys)) {
        const enVariants = variantsOf(key, enKeys).filter((candidate) => key === candidate || key.endsWith(key));
        const candidates = enKeys[key] !== undefined ? [key] : enVariants;
        expect(candidates.length, `missing en variant for ${namespace}.${key}`).toBeGreaterThan(0);
        for (const candidate of candidates) {
          expect(placeholders(enKeys[candidate] ?? ''), `${namespace}.${candidate}`).toEqual(
            placeholders(zhValue),
          );
        }
      }
    }
  });

  it('has no empty translations', () => {
    for (const [namespace, keys] of [...zh, ...en]) {
      for (const [key, value] of Object.entries(keys)) {
        expect(value.trim(), `${namespace}.${key}`).not.toBe('');
      }
    }
  });
});
