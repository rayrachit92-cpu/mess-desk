/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf3',
          100: '#d6f5e4',
          500: '#24a562',
          600: '#16884e',
          700: '#126d40',
          800: '#115735',
        },
      },
    },
  },
  plugins: [],
};
