/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
        },
        line: {
          subtle: 'rgb(var(--line-subtle) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--ink-tertiary) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          50: '#EEF1FF',
          100: '#DDE3FF',
          200: '#BAC6FF',
          300: '#91A3FF',
          400: '#6B80FF',
          500: '#4A66FE',
          600: '#3D5AFE',
          700: '#2F47D6',
          800: '#283BB0',
          900: '#22338F',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Instrument Sans Variable',
          'Instrument Sans',
          'PingFang SC',
          'HarmonyOS Sans SC',
          'Microsoft YaHei',
          'Noto Sans SC',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'Cascadia Code',
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      fontSize: {
        11: ['11px', { lineHeight: '16px' }],
        12: ['12px', { lineHeight: '18px' }],
        13: ['13px', { lineHeight: '20px' }],
        14: ['14px', { lineHeight: '21px' }],
        16: ['16px', { lineHeight: '24px' }],
        18: ['18px', { lineHeight: '26px' }],
        22: ['22px', { lineHeight: '30px' }],
        28: ['28px', { lineHeight: '36px' }],
        34: ['34px', { lineHeight: '42px' }],
      },
      borderRadius: {
        card: '14px',
        pop: '16px',
        control: '10px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)',
        pop: '0 12px 32px -12px rgb(15 23 42 / 0.25), 0 4px 12px -4px rgb(15 23 42 / 0.10)',
        lift: '0 8px 20px -12px rgb(15 23 42 / 0.22), 0 2px 6px -2px rgb(15 23 42 / 0.06)',
      },
      transitionTimingFunction: {
        enter: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        popIn: {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        rise: 'rise 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        fade: 'fade 0.18s ease-out both',
        'pop-in': 'popIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
