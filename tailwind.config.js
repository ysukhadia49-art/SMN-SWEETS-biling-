/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        smn: {
          maroon: '#6B1124',
          'maroon-dark': '#4D0C1A',
          'maroon-light': '#891830',
          red: '#B91C1C',
          'red-dark': '#991B1B',
          'red-light': '#DC2626',
          gold: '#D97706',
          'gold-light': '#F59E0B',
          'gold-soft': '#FEF3C7',
          'gold-accent': '#B45309',
          cream: '#FFFDF9',
          'cream-warm': '#FBF6EE',
          beige: '#F4ECE1',
          'beige-dark': '#E6D7C3',
          brown: '#2C1810',
          'brown-light': '#4A2A1C',
          charcoal: '#1E1E24',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        gujarati: ['"Noto Sans Gujarati"', 'Shruti', '"Nirmala UI"', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}

