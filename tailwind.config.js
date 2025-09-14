// tailwind.config.js
module.exports = {
  content: [
    "./*.html",
    "./admin/**/*.html",
    "./**/*.js", // JavaScript内のクラスも対象にする場合
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}