/**
 * server.js (full)
 * - Only entrypoint that loads .env and listens on PORT
 * - Session/Postgres, static, webhooks (raw body), main DB-backed APIs
 * - Mounts /json-api (router from server-json.js) and serves /uploads globally
 */

const { loadEnv } = require("./config/env");
loadEnv();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const expressLayouts = require('express-ejs-layouts');

const db = require('./database.js');
const { logSecretFingerprint } = require('./utils/logSecretFingerprint');
const { sendMail } = require('./utils/mailer');

const app = express();
app.set('trust proxy', 1);
// === secret fingerprint (ログ最小限)
logSecretFingerprint('WEBHOOK_SECRET', process.env.WEBHOOK_SECRET);

// ------------------------------
// View Engine Setup (EJS)
// ------------------------------
const projectRoot = path.join(__dirname, '../..');
app.set('view engine', 'ejs');
app.set('views', path.join(projectRoot, 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');


// ------------------------------
// 静的配信・圧縮など（必要に応じ追加）
// ------------------------------
app.use(express.static(path.join(projectRoot, 'public')));
// app.use(express.static(path.join(projectRoot, 'src', 'views'))); // EJSレンダリングのため削除
app.use(express.static(path.join(projectRoot, 'src', 'js')));
app.use(express.static(path.join(projectRoot, 'src', 'assets')));

// フロントエンドはルート直下の task.txt を直接取得するため、明示的に送信する
app.get('/task.txt', (req, res, next) => {
  const taskFilePath = path.join(projectRoot, 'task.txt');
  res.sendFile(taskFilePath, (err) => {
    if (err) next(err);
  });
});

// ------------------------------
// セッション（Postgres or File）
// ------------------------------
let sessionStore;
if (db.useSqlite) {
  const FileStore = require('session-file-store')(session);
  sessionStore = new FileStore({
    path: path.join(__dirname, '../../sessions'),
    ttl: 86400,
  });
  console.log('Using FileStore for sessions.');
} else {
  sessionStore = new pgSession({
    pool: db.pool,
    tableName: 'session',
  });
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'a-bad-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// ------------------------------
// Global Body Parsers
// ------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));



// ------------------------------
// 認証ミドルウェア
// ------------------------------
const { authMiddleware, webhookAuth } = require('./middleware/auth.middleware.js');

// ================================================================
// News API
// ================================================================
const newsRoutes = require('./routes/news.routes.js');
app.use('/api/news', newsRoutes);

// ================================================================
// Activity API
// ================================================================
const activityRoutes = require('./routes/activity.routes.js');
app.use('/api/activities', activityRoutes);

// ================================================================
// Settings API
// ================================================================
const settingsRoutes = require('./routes/settings.routes.js');
const { getPublicSettings } = require('./controllers/settings.controller.js');
app.use('/api/settings', settingsRoutes);
// 既存フロントエンド資産は /api/public-settings を参照しているため、後方互換のために公開設定用エイリアスを追加
app.get('/api/public-settings', getPublicSettings);

// ================================================================
// Auth API
// ================================================================
const authRoutes = require('./routes/auth.routes.js');
app.use('/api', authRoutes); // Mount at /api to handle /api/login, /api/logout, etc.

// ================================================================
// Admin API
// ================================================================
const adminRoutes = require('./routes/admin.routes.js');
app.use('/api/admin', adminRoutes);

// ================================================================
// Contact API
// ================================================================
const contactRoutes = require('./routes/contact.routes.js');
app.use('/api/contact', contactRoutes);

// ------------------------------
// Admin Static Files (HTML)
// ------------------------------
// app.use('/admin', express.static(path.join(projectRoot, 'src', 'views', 'admin')));

// ================================================================
// Settings Middleware (All Views)
// ================================================================
const { loadSiteSettings } = require('./middleware/siteConfig.middleware.js');

// ================================================================
// View Routes (SSR Pages)
// ================================================================
const viewRoutes = require('./routes/view.routes.js');
// Viewルートにのみ設定読み込みミドルウェアを適用
app.use('/', loadSiteSettings, viewRoutes);

// ================================================================
// Global Error Handler (Must be the last middleware)
// ================================================================
const { errorHandler } = require('./middleware/error.middleware.js');
app.use(errorHandler);

// ------------------------------
// /uploads を mount（画像配信）
// ------------------------------
// publicディレクトリは既に静的配信されているが、uploadsフォルダの存在確認と作成を行う
const UPLOAD_DIR = path.join(projectRoot, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
// 追加のマウントは不要（publicがルートマウントされているため）ですが、
// 明示的にキャッシュコントロール等をしたい場合は以下のようにしても良い。
// 今回はpublicの設定（特にないのでデフォルト）に任せるか、以下を残すならパスを修正。
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  immutable: false, // アップロード画像は変更される可能性があるためfalse推奨だが一意なファイル名ならtrueでも可
}));

// ------------------------------
// 起動シーケンス
// ------------------------------
async function bootstrap() {
  try {
    // 1. DB Setup
    await db.setupDatabase();

    // 2. Migration
    const { runMigration } = require('./migrations/convert-drive-urls.js');
    try {
      await runMigration();
    } catch (err) {
      console.error('!!! Data migration for URL conversion failed !!!', err);
      // Continue even if migration fails in dev
    }

    // 3. Start Server
    startServer(app);
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

// ------------------------------
// 起動（唯一の listen ）
// ------------------------------
function startServer(app) {
  const port = Number(process.env.PORT || 10000);
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`env.PORT=${process.env.PORT ?? 'undefined'}`);
  });
  return server;
}

bootstrap();
