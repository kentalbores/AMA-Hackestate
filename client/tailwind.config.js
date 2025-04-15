/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#eff6f2",
        secondary: "#4a8767",
        tertiary: "#125b50",
      },
    },
  },
  plugins: [],
} 