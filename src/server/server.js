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

// Security Packages
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');

const db = require('./database.js');
const { logSecretFingerprint } = require('./utils/logSecretFingerprint');
const { sendMail } = require('./utils/mailer');

const app = express();
app.set('trust proxy', 1);

// === Security Middleware ===
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "https://placehold.co", "https://drive.google.com", "https://*.googleusercontent.com"], // Allow all HTTPS images to prevent broken user content
      frameSrc: ["'self'", "https://www.google.com", "https://docs.google.com"], // For Google Maps & Forms
      connectSrc: ["'self'", "https://unpkg.com", "https://*.googleapis.com"], // Sometimes needed for fetching resources
      upgradeInsecureRequests: [],
    },
  })
);

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

// Rate limiting for webhooks (緩め：1分間に10回まで)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 1分間に10回まで
  message: { error: 'Too many requests, please try again later' }
});

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

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'a-bad-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  },
});
app.use(sessionMiddleware);

// ------------------------------
// Global Body Parsers
// ------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ------------------------------
// CSRF Protection
// ------------------------------
// API endpoints called by external webhooks or public forms might need exclusion,
// but for now we apply globally and allow exclusion via route ordering or shim.
// However, since we have a mix of API and View, we will use it with cookie: false (default uses session).
const csrfProtection = csurf();

// ------------------------------
// 認証ミドルウェア
// ------------------------------
const { authMiddleware, webhookAuth } = require('./middleware/auth.middleware.js');

// ================================================================
// News API
// ================================================================
const newsRoutes = require('./routes/news.routes.js');
const { newsWebhook } = require('./controllers/news.controller.js');

// Webhook（外部GAS等）：CSRF不要（HMAC認証で保護）、raw bodyで受信
const webhookRawJson = express.raw({ type: 'application/json', limit: '1mb' });
app.post('/api/news/webhook', webhookLimiter, webhookRawJson, webhookAuth, newsWebhook);

// その他の管理画面向けAPI：CSRF保護あり
app.use('/api/news', csrfProtection, newsRoutes);

// ================================================================
// Activity API
// ================================================================
const activityRoutes = require('./routes/activity.routes.js');
const { activityWebhook } = require('./controllers/activity.controller.js');

// Webhook（外部GAS等）：CSRF不要（HMAC認証で保護）
app.post('/api/activities/webhook', webhookLimiter, webhookRawJson, webhookAuth, activityWebhook);

// その他の管理画面向けAPI：CSRF保護あり
app.use('/api/activities', csrfProtection, activityRoutes);

// ================================================================
// Settings API
// ================================================================
const settingsRoutes = require('./routes/settings.routes.js');
const { getPublicSettings } = require('./controllers/settings.controller.js');
app.use('/api/settings', csrfProtection, settingsRoutes);
// 既存フロントエンド資産は /api/public-settings を参照しているため、後方互換のために公開設定用エイリアスを追加
app.get('/api/public-settings', getPublicSettings);

// ================================================================
// Auth API
// ================================================================
const authRoutes = require('./routes/auth.routes.js');
// Login needs rate limit and CSRF
app.use('/api/login', loginLimiter, csrfProtection);
app.use('/api', csrfProtection, authRoutes); // Mount at /api to handle /api/login, /api/logout, etc.

// ================================================================
// Admin API
// ================================================================
const adminRoutes = require('./routes/admin.routes.js');
app.use('/api/admin', csrfProtection, adminRoutes);

// ================================================================
// Contact API
// ================================================================
const contactRoutes = require('./routes/contact.routes.js');
// Contact form is public POST. It needs CSRF.
// Using session-based CSRF requires the user to visit the page strictly first to get a token.
app.use('/api/contact', csrfProtection, contactRoutes);

// ------------------------------
// Admin UI Routes
// ------------------------------
app.get('/admin', csrfProtection, (req, res) => {
  // Render EJS with CSRF token, using no layout or a dedicated admin layout if preferred.
  // The original was app.html. We use 'admin/app' (admin/app.ejs).
  res.render('admin/app', {
    layout: false, // Don't use the public site layout
    csrfToken: req.csrfToken()
  });
});
app.get('/admin/login', csrfProtection, (req, res) => {
  res.render('admin/login', {
    layout: false,
    csrfToken: req.csrfToken()
  });
});
// その他のアドミン関連静的ファイル (JS, CSS等)
app.use('/admin', express.static(path.join(projectRoot, 'src', 'views', 'admin')));



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
