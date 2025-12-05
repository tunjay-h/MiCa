/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0b1224',
        aurora: '#4ad3e8',
        sand: '#e5e7eb'
      }
    }
  },
  plugins: []
};
