/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF1FF',
          100: '#DDE4FF',
          200: '#C1CCFF',
          300: '#9AABFF',
          400: '#7488FF',
          500: '#5468FF',
          600: '#3D5AFE',
          700: '#2F49E0',
          800: '#2A3FBA',
          900: '#263894',
        },
        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        surface: {
          0: 'rgb(var(--surface-0) / <alpha-value>)',
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          3: 'rgb(var(--surface-3) / <alpha-value>)',
        },
        // Neutral scale tuned for the workspace: cool paper greys in light mode,
        // deep ink panels in dark mode.
        gray: {
          50: '#f7f8fa',
          100: '#f1f3f7',
          200: '#e5e8ee',
          300: '#cbd2de',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#1f2937',
          800: '#111827',
          900: '#0b0f19',
          950: '#060a12',
        },
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
        mono: ['Cascadia Code', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)',
        'card-hover': '0 8px 24px -12px rgb(15 23 42 / 0.18), 0 2px 6px rgb(15 23 42 / 0.05)',
        pop: '0 12px 32px -12px rgb(15 23 42 / 0.25), 0 4px 12px -4px rgb(15 23 42 / 0.10)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.24s ease-out both',
        'fade-up': 'fade-up 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'slide-in-right': 'slide-in-right 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
