// config/env.js
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
  if (loaded) return;

  const NODE_ENV = process.env.NODE_ENV || 'development';
  const projectRoot = path.resolve(__dirname, '..', '..', '..');

  // .env.development, .env.production などを読み込む
  const envPath = path.join(projectRoot, `.env.${NODE_ENV}`);
  if (fs.existsSync(envPath)) {
    console.log(`[env] Loading environment from ${path.basename(envPath)}`);
    dotenv.config({ path: envPath });
  }

  // 基本的な .env ファイルを読み込む (既に設定されている変数は上書きされない)
  const basePath = path.join(projectRoot, '.env');
  if (fs.existsSync(basePath)) {
    console.log(`[env] Loading environment from .env`);
    dotenv.config({ path: basePath });
  }

  loaded = true;
}

module.exports = { loadEnv };