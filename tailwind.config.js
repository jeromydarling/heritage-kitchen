/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF6F0',
        surface: '#FFFDF8',
        terracotta: {
          DEFAULT: '#A84B2F',
          dark: '#8A3A22',
        },
        ink: '#3B2314',
        muted: '#7A6B5D',
        rule: '#E8DFD3',
        paper: '#F5EEDF',
        // Kid-mode avatar palette — gentle, distinguishable, and
        // all playing nicely with the cream-and-terracotta core.
        sage: {
          DEFAULT: '#7A8F6F',
          dark: '#5A6E50',
        },
        butter: '#E8C46B',
        plum: '#8A4F6D',
        sky: '#6A8AA8',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Lora', 'Georgia', 'serif'],
        sans: ['Inter', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Courier Prime"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(59,35,20,0.06), 0 8px 24px -12px rgba(59,35,20,0.12)',
      },
    },
  },
  plugins: [],
};
