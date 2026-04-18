import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        n: {
          // ── surfaces ────────────────────────────
          bg:       '#191919',
          surface:  '#252525',
          raised:   '#2D2D2D',
          hover:    '#313131',
          // ── borders ─────────────────────────────
          border:   '#383838',
          divider:  '#2F2F2F',
          // ── text ────────────────────────────────
          text:     '#E6E6E6',
          sub:      '#9B9B9B',
          muted:    '#606060',
          // ── accent (Freedom green) ───────────────
          green:    '#00C389',
          'green-d': '#00A876',
          'green-x': 'rgba(0,195,137,0.12)',
          // ── status ──────────────────────────────
          red:      '#E05252',
          'red-x':  'rgba(224,82,82,0.10)',
          amber:    '#E8A44A',
          'amber-x':'rgba(232,164,74,0.10)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 0 0 1px #383838',
        'panel-lg': '0 8px 32px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}

export default config
