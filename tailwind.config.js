// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/views/**/*.ejs', // ejsファイルを監視対象に
    './src/js/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

