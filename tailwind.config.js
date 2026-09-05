/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './public/**/*.{html,js}',
    './src/client/**/*.{ts,js,html}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          bg: '#FAF8FC',
          card: '#FFFFFF',
          text: '#1A0B2E',
          muted: '#6B5B7B',
          border: '#E9E1F0',
          accent: '#581C87',
          accentHover: '#3B0764',
          surface: '#F3EEF9',
          tint: '#F5F3FF',
          tintBorder: '#DDD6FE',
        }
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(26, 11, 46, 0.05)',
      }
    }
  },
  plugins: [],
};
