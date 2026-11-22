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
        // Pääväri CLAUDE.md:n mukaan (#00C8FF). Aiemmin Tailwind käytti
        // #00D4FF ja kaaviot #00C8FF; nyt molemmat ovat samaa sävyä.
        ice: {
          DEFAULT: '#00C8FF',
          dim: 'rgba(0, 200, 255, 0.12)',
        },
        // Tekstisävyt sivu-uudistuksen luonnoksesta. Kiinteät sävyt
        // korvaavat läpinäkyvän valkoisen (white/40–70), jonka kontrasti
        // jäi navy-pohjalla pienessä tekstissä liian matalaksi.
        teksti: '#E6EDF5',
        toissijainen: '#B8C4D2',
        vaimea: '#8899AA',
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
