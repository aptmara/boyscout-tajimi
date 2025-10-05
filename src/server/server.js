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

// ------------------------------
// セッション（Postgres）
// ------------------------------
app.use(
  session({
    store: new pgSession({
      pool: db.pool,
      tableName: 'session',
    }),
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
// DB 初期化
// ------------------------------
db.setupDatabase().catch((e) => {
  console.error('setupDatabase error:', e);
});

// ------------------------------
// データ移行スクリプト
// ------------------------------
const { runMigration } = require('./migrations/convert-drive-urls.js');
runMigration().catch(err => {
  console.error('!!! Data migration for URL conversion failed !!!', err);
  // Production環境では、移行の失敗が致命的な場合、プロセスを終了させることも検討
  // process.exit(1);
});

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
app.use('/api/settings', settingsRoutes);

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


// ================================================================
// View Routes (SSR Pages)
// ================================================================
const viewRoutes = require('./routes/view.routes.js');
app.use('/', viewRoutes);


// ================================================================
// Global Error Handler (Must be the last middleware)
// ================================================================
const { errorHandler } = require('./middleware/error.middleware.js');
app.use(errorHandler);



// ------------------------------
// /uploads を mount（画像配信）
// ------------------------------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, {
  etag: true,
  maxAge: '7d', // 7日間キャッシュ
  immutable: true,
}));

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

startServer(app);