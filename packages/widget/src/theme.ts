export type WidgetDensity = 'compact' | 'comfortable';

export type WidgetTheme = {
  primaryColor?: string;
  buttonLabel?: string;
  /** 面板圆角，6–28px；默认 16。 */
  radius?: number;
  /** 表单密度，默认 compact。 */
  density?: WidgetDensity;
};

const DEFAULT_PRIMARY = '#4C6EF5';

export type ResolvedColor = {
  hex: string;
  rgb: string;
};

/** 解析 #rgb / #rrggbb；非法值回退到默认主色。 */
export function resolveColor(input?: string): ResolvedColor {
  const fallback: ResolvedColor = { hex: DEFAULT_PRIMARY, rgb: '76,110,245' };
  if (!input) return fallback;

  let hex = input.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    hex = `#${hex
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('')}`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return fallback;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { hex, rgb: `${r},${g},${b}` };
}

export function resolveRadius(radius?: number): number {
  if (typeof radius !== 'number' || !Number.isFinite(radius)) return 16;
  return Math.min(28, Math.max(6, Math.round(radius)));
}

export function resolveDensity(density?: string): WidgetDensity {
  return density === 'comfortable' ? 'comfortable' : 'compact';
}
