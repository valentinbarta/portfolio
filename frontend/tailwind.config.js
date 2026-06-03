/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f1419',
          800: '#1a202c',
          700: '#2d3748'
        },
        neon: {
          purple: '#a855f7',
          cyan: '#06b6d4',
          pink: '#ec4899'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    }
  },
  darkMode: 'class',
  plugins: []
}
