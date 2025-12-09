/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a90d6', // Curious Blue
        secondary: '#FFFFFF', // White
        background: '#F8FAFC', // Slate 50
        'brand-teal': '#053962',      // Teal Blue
        'brand-orange': '#f19628',    // Carrot Orange
        'brand-curious': '#1a90d6',   // Curious Blue
        'brand-picton': '#1fa6ee',    // Picton Blue
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
