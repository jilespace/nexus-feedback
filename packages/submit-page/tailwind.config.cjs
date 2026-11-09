/**
 * CommonJS 形式：Vite 开发服务器通过 require 缓存加载 Tailwind 配置，
 * 在 Node 24 下 ESM 配置不会随文件修改重新加载，改 token 需要重启 dev server。
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F7F9',
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F9FAFB',
          sunken: '#F1F3F5',
        },
        line: {
          DEFAULT: '#E5E8EE',
          strong: '#CBD2DE',
        },
        ink: {
          1: '#0F172A',
          2: '#475569',
          3: '#7B8794',
        },
        brand: {
          50: '#EEF1FF',
          100: '#DDE3FF',
          500: '#4D66FF',
          600: '#3D5AFE',
          700: '#3149D8',
        },
        accent: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          600: '#D97706',
          700: '#B45309',
        },
        success: {
          50: '#ECFDF5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        danger: {
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#F0F9FF',
          500: '#0EA5E9',
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
        mono: ['Cascadia Code', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        pop: '16px',
        field: '10px',
        badge: '6px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)',
        pop: '0 12px 32px -12px rgb(15 23 42 / 0.25), 0 4px 12px -4px rgb(15 23 42 / 0.10)',
        lift: '0 2px 6px -1px rgb(15 23 42 / 0.08), 0 8px 20px -12px rgb(15 23 42 / 0.12)',
      },
      transitionTimingFunction: {
        enter: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        checkDraw: {
          '0%': { strokeDashoffset: '32' },
          '100%': { strokeDashoffset: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'fade-in': 'fadeIn 0.2s ease-out both',
        progress: 'progress 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
