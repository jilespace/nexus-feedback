// Minimal browser globals so modules that touch localStorage/DOM (i18n setup,
// theme plumbing) can be imported in the node test environment.
const store = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement: { lang: 'zh-CN' },
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  configurable: true,
  writable: true,
});
