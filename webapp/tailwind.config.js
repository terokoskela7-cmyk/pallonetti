/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#060b12',
          800: '#0B1120',
          700: '#111827',
          600: '#1a2640',
          500: '#243350',
        },
        ice: {
          DEFAULT: '#00D4FF',
          dim: 'rgba(0, 212, 255, 0.12)',
        },
        aurora: '#00FF88',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
