// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./admin/**/*.html",
    "./*.{js,ts}",
    "./pages/**/*.{html,md}",
    "./components/**/*.{html,js,ts}",
    "./scripts/**/*.{js,ts}",
    "./views/**/*.{ejs,html}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

