// config/env.js
let loaded = false;
function loadEnv(options) {
  if (loaded) return;
  require("dotenv").config(options || {});
  loaded = true;
}
module.exports = { loadEnv };

