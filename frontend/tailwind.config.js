/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C2321',
        paper: '#FAF6EE',
        marigold: {
          DEFAULT: '#E2A63B',
          light: '#F6E6C4',
          dark: '#C88A22'
        },
        brick: {
          DEFAULT: '#A8461F',
          dark: '#8A3818'
        },
        leaf: {
          DEFAULT: '#4B6455',
          light: '#DCE6DF',
          dark: '#334539'
        },
        ledger: '#D8CBAE'
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif']
      }
    }
  },
  plugins: []
}
