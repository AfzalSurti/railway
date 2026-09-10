/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eefbf8',
          100: '#d5f5ee',
          500: '#0f9d8a',
          600: '#0b7d6e',
          700: '#0a6559',
          900: '#06342f',
        },
        ink: {
          950: '#07111f',
          900: '#0c1929',
          800: '#132337',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};
