/**
 * server.js (full, raw-HMAC対応)
 * - /api/news: 公開GET（一覧/詳細）、変更系は認証必須
 * - /api/activities: 同上
 * - /api/*-webhook: Apps Script からのHMAC検証（raw body）+ 画像DL保存
 * - /uploads 静的配信
 *
 * 前提：
 *   - Node 18+（グローバル fetch）
 *   - .env: WEBHOOK_SECRET, SESSION_SECRET, PORT, NODE_ENV, HMAC_TOLERANCE_SEC(optional)
 *   - database.js: db.query / setupDatabase を提供
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------
// 静的・セッション
// ------------------------------

// 既存サイト配信（必要に応じて調整）
app.use(express.static(path.join(__dirname, '/')));

// /uploads の静的配信
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// セッション
app.use(
  session({
    store: new FileStore({
      path: path.join(__dirname, 'sessions'),
      ttl: 86400,
      reapInterval: 86400,
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
// Webhook用 raw 受信（ルート限定）
// ------------------------------
const webhookRawJson = express.raw({ type: 'application/json', limit: '1mb' });

// グローバルの JSON/urlencoded は**Webhookを除外**して適用
app.use((req, res, next) => {
  if (req.path === '/api/news-webhook' || req.path === '/api/activity-webhook') return next();
  return express.json({ limit: '1mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/api/news-webhook' || req.path === '/api/activity-webhook') return next();
  return express.urlencoded({ extended: true })(req, res, next);
});

// ------------------------------
// DB 初期化
// ------------------------------
db.setupDatabase().catch((e) => {
  console.error('setupDatabase error:', e);
});

// ------------------------------
// 認証ミドルウェア
// ------------------------------
const authMiddleware = (req, res, next) => {
  if (req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/admin/login.html');
};

// ------------------------------
// セッション系 API
// ------------------------------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const { rows } = await db.query(
      'SELECT id, username, password FROM admins WHERE username = $1',
      [username]
    );
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.user = { id: admin.id, username: admin.username };
    res.json({ message: 'Login successful' });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Could not log out' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

app.get('/api/session', (req, res) => {
  if (req.session.user) return res.json({ loggedIn: true, user: req.session.user });
  return res.json({ loggedIn: false });
});

// ------------------------------
// HMAC 署名検証（Webhook 用）
// ------------------------------
function verifyHmacSignature({ bodyRaw, timestamp, signature }) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;

  const tol = parseInt(process.env.HMAC_TOLERANCE_SEC || '300', 10); // 既定: 5分
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(now - ts) > tol) return false;

  // "sha256=" の有無を許容
  const sigHex = String(signature || '').replace(/^sha256=/i, '').trim();
  if (!/^[0-9a-f]{64}$/i.test(sigHex)) return false;

  // 期待：ts.body の “生文字列”
  const expHex = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.${bodyRaw}`, 'utf8')
    .digest('hex');

  // 固定時間比較
  const a = Buffer.from(sigHex, 'utf8');
  const b = Buffer.from(expHex, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function webhookAuth(req, res, next) {
  try {
    const timestamp = req.header('X-Timestamp');
    const signature = req.header('X-Signature');

    // raw受信時: req.body は Buffer。そうでなければ JSON化後のObject。
    const bodyRaw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body || {});

    if (!verifyHmacSignature({ bodyRaw, timestamp, signature })) {
      return res.status(401).json({ error: 'invalid signature' });
    }

    // 検証通過後、JSONに戻す（rawのときのみ）
    if (Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(bodyRaw);
      } catch {
        return res.status(400).json({ error: 'bad json' });
      }
    }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

// ------------------------------
// 画像保存（Google系の許可ドメインのみ）
// ------------------------------
const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'lh3.googleusercontent.com',
  'googleusercontent.com',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 20_000;

async function downloadImageToUploads(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error('invalid url');
  }
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error('host not allowed');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);

  const ctype = res.headers.get('content-type') || '';
  if (!ctype.startsWith('image/')) throw new Error('not an image');

  const ext = ctype.split('/')[1]?.split(';')[0] || 'bin';
  const filename = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const fileStream = fs.createWriteStream(filepath, { flags: 'wx' });

  const reader = res.body.getReader();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.length;
      if (total > MAX_BYTES) {
        reader.releaseLock();
        fileStream.close();
        try { await fsp.unlink(filepath); } catch {}
        throw new Error('file too large');
      }
      fileStream.write(value);
    }
  } finally {
    fileStream.close();
  }

  return { publicPath: `/uploads/${filename}`, contentType: ctype };
}

// ================================================================
// News API
// ================================================================

// 公開 GET（一覧）
app.get('/api/news', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, image_urls, created_at
       FROM news
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/news error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 公開 GET（詳細）
app.get('/api/news/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, image_urls, created_at
       FROM news
       WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'News not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/news/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 変更系は認証必須
app.use('/api/news', authMiddleware);

// 作成（管理画面）
app.post('/api/news', async (req, res) => {
  try {
    const { title, content, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    const saved = [];
    for (const url of Array.isArray(images) ? images : []) {
      try {
        const { publicPath } = await downloadImageToUploads(url);
        saved.push(publicPath);
      } catch (e) {
        console.warn('news image skip:', url, e.message);
      }
    }

    const { rows } = await db.query(
      `INSERT INTO news (title, content, image_urls)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [title, content, JSON.stringify(saved)]
    );
    res.status(201).json({ id: rows[0].id, message: 'Created' });
  } catch (err) {
    console.error('POST /api/news error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新（管理画面）
app.put('/api/news/:id', async (req, res) => {
  try {
    const { title, content, images = null } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    let clause = '';
    const params = [title, content, req.params.id];
    if (Array.isArray(images)) {
      const saved = [];
      for (const url of images) {
        try {
          const { publicPath } = await downloadImageToUploads(url);
          saved.push(publicPath);
        } catch (e) {
          console.warn('news image skip:', url, e.message);
        }
      }
      clause = ', image_urls = $3';
      params.splice(2, 0, JSON.stringify(saved)); // $3 に image_urls
    }

    const { rowCount } = await db.query(
      `UPDATE news
       SET title = $1,
           content = $2
           ${clause}
       WHERE id = $${clause ? 4 : 3}`,
      params
    );

    if (rowCount === 0) return res.status(404).json({ error: 'News not found' });
    res.json({ id: req.params.id, message: 'Updated' });
  } catch (err) {
    console.error('PUT /api/news/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 削除（管理画面）
app.delete('/api/news/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(`DELETE FROM news WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'News not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/news/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook（GAS → サーバー） raw -> auth -> handler
app.post('/api/news-webhook', webhookRawJson, webhookAuth, async (req, res) => {
  try {
    const { title, content, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'タイトルと本文は必須です。' });

    const saved = [];
    for (const url of Array.isArray(images) ? images : []) {
      try {
        const { publicPath } = await downloadImageToUploads(url);
        saved.push(publicPath);
      } catch (e) {
        console.warn('news webhook image skip:', url, e.message);
      }
    }

    const { rows } = await db.query(
      `INSERT INTO news (title, content, image_urls)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [title, content, JSON.stringify(saved)]
    );
    return res.status(201).json({ id: rows[0].id, message: '投稿に成功しました。' });
  } catch (e) {
    console.error('News Webhook Error:', e);
    return res.status(500).json({ error: 'サーバー内部でエラーが発生しました。' });
  }
});

// ================================================================
// Activity API
// ================================================================

// 公開 GET（一覧）
app.get('/api/activities', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, category, activity_date, image_urls, created_at
       FROM activities
       ORDER BY activity_date DESC NULLS LAST, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/activities error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 公開 GET（詳細）
app.get('/api/activities/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, category, activity_date, image_urls, created_at
       FROM activities
       WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/activities/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 変更系は認証必須
app.use('/api/activities', authMiddleware);

// 作成（管理画面）
app.post('/api/activities', async (req, res) => {
  try {
    const { title, content, category = null, activity_date = null, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    const saved = [];
    for (const url of Array.isArray(images) ? images : []) {
      try {
        const { publicPath } = await downloadImageToUploads(url);
        saved.push(publicPath);
      } catch (e) {
        console.warn('activity image skip:', url, e.message);
      }
    }

    const { rows } = await db.query(
      `INSERT INTO activities (title, content, category, activity_date, image_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, content, category, activity_date, JSON.stringify(saved)]
    );
    res.status(201).json({ id: rows[0].id, message: 'Created' });
  } catch (err) {
    console.error('POST /api/activities error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新（管理画面）
app.put('/api/activities/:id', async (req, res) => {
  try {
    const { title, content, category = null, activity_date = null, images = null } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    let imageClause = '';
    const params = [title, content, category, activity_date, req.params.id];
    if (Array.isArray(images)) {
      const saved = [];
      for (const url of images) {
        try {
          const { publicPath } = await downloadImageToUploads(url);
          saved.push(publicPath);
        } catch (e) {
          console.warn('activity image skip:', url, e.message);
        }
      }
      imageClause = ', image_urls = $5';
      params.splice(4, 0, JSON.stringify(saved)); // $5 に image_urls
    }

    const { rowCount } = await db.query(
      `UPDATE activities
       SET title = $1,
           content = $2,
           category = $3,
           activity_date = $4
           ${imageClause}
       WHERE id = $${imageClause ? 6 : 5}`,
      params
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json({ id: req.params.id, message: 'Updated' });
  } catch (err) {
    console.error('PUT /api/activities/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 削除（管理画面）
app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM activities WHERE id = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/activities/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook（GAS → サーバー） raw -> auth -> handler
app.post('/api/activity-webhook', webhookRawJson, webhookAuth, async (req, res) => {
  try {
    const { title, content, category = null, activity_date = null, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'タイトルと本文は必須です。' });

    const saved = [];
    for (const url of Array.isArray(images) ? images : []) {
      try {
        const { publicPath } = await downloadImageToUploads(url);
        saved.push(publicPath);
      } catch (e) {
        console.warn('activity webhook image skip:', url, e.message);
      }
    }

    const { rows } = await db.query(
      `INSERT INTO activities (title, content, category, activity_date, image_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, content, category, activity_date, JSON.stringify(saved)]
    );
    return res.status(201).json({ id: rows[0].id, message: '活動報告の投稿に成功しました。' });
  } catch (e) {
    console.error('Activity Webhook Error:', e);
    return res.status(500).json({ error: 'サーバー内部エラー' });
  }
});

// ------------------------------
// 起動
// ------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
