/**
 * server.js (full, raw-HMAC対応 / 画像はURLパススルー)
 * - /api/news: 公開GET（一覧/詳細）、変更系は認証必須
 * - /api/activities: 同上
 * - /api/*-webhook: Apps Script からの HMAC 検証（raw body）
 * - /uploads は使わない（Render ディスク非依存）
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
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('./database.js');

// === Secret fingerprint（ログ用: 先頭16桁のみ） ===
(function logSecretFingerprint() {
  const s = process.env.WEBHOOK_SECRET || '';
  const fp = crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
  console.log('[SECRET_FP]', fp);
  if (process.env.NODE_ENV !== 'production') {
    const secret = process.env.WEBHOOK_SECRET || '';
    const codes = [...secret].map(c => c.charCodeAt(0));
    console.log('[SECRET_LEN]', secret.length, 'head', codes.slice(0,8), 'tail', codes.slice(-8));
  }

})();

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------
// 静的・セッション
// ------------------------------

// 既存サイト配信（必要に応じて調整）
app.use(express.static(path.join(__dirname, '/')));

// セッション（保存先ディレクトリを用意）
const SESS_DIR = path.join(__dirname, 'sessions');
fs.mkdirSync(SESS_DIR, { recursive: true });

app.use(
  session({
    store: new FileStore({
      path: SESS_DIR,
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
  const secret = process.env.WEBHOOK_SECRET || '';
  if (!secret) return false;

  const tol = parseInt(process.env.HMAC_TOLERANCE_SEC || '300', 10); // 既定: 5分
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(String(timestamp || ''), 10);
  if (!ts || Math.abs(now - ts) > tol) return false;

  // 署名ヘッダ正規化: "sha256=<hex>" or "<hex>"
  const m =
    String(signature || '').match(/^sha256=([0-9a-fA-F]{64})$/) ||
    String(signature || '').match(/^([0-9a-fA-F]{64})$/);
  if (!m) return false;
  const gotBuf = Buffer.from(m[1], 'hex');
  if (gotBuf.length !== 32) return false;

  // 期待： HMAC-SHA256(secret, "<ts>.<raw>") の**バイト列**
  const expBuf = crypto.createHmac('sha256', secret).update(`${ts}.${bodyRaw}`, 'utf8').digest();
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SIG_DEBUG]', {
      expSigHead: expBuf.toString('hex').slice(0,16),
      gotSigHead: gotBuf.toString('hex').slice(0,16),
      gotLen: gotBuf.length,
      ts: String(ts),
      // 重要：HMACはUTF-8バイトで計算するので、bytes長を出す
      bodyChars: bodyRaw.length,
      bodyBytes: Buffer.byteLength(bodyRaw, 'utf8')
    });
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SIG_DEBUG]', {
      expSigHead: expBuf.toString('hex').slice(0,16),
      gotSigHead: gotBuf.toString('hex').slice(0,16),
      ts: String(ts),
      bodyLen: Buffer.byteLength(bodyRaw, 'utf8')
    });
  }
// ★デバッグ（必ず後で消す or NODE_ENVで抑止）
 if (process.env.NODE_ENV !== 'production') {
   console.warn('[SIG_DEBUG]', {
     expSigHead: expBuf.toString('hex').slice(0,16),
     gotSigHead: gotBuf.toString('hex').slice(0,16),
     gotLen: gotBuf.length,
     ts: String(ts),
     bodyBytes: Buffer.byteLength(bodyRaw,'utf8')
   });
 }
  // 固定時間比較
  return gotBuf.length === expBuf.length && crypto.timingSafeEqual(gotBuf, expBuf);
}

function webhookAuth(req, res, next) {
  try {
    const secret = process.env.WEBHOOK_SECRET || '';
    if (!secret) return res.status(500).json({ error: 'server misconfigured' });

    const timestamp = req.get('X-Timestamp');
    const signature = req.get('X-Signature');

    // raw受信時: req.body は Buffer。そうでなければ JSON化後のObject。
    const bodyRaw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body || {});

    // 失敗時はログに最小限の情報のみ
    if (!verifyHmacSignature({ bodyRaw, timestamp, signature })) {
      const bodySha = crypto.createHash('sha256').update(bodyRaw, 'utf8').digest('hex');
      const sigHex = String(signature || '').replace(/^sha256=/i, '').trim();
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(String(timestamp || '0'), 10);
      const skew = isFinite(ts) ? Math.abs(now - ts) : null;
      console.warn('[SIG_FAIL]', {
        ts: timestamp,
        skew,
        gotSigHead: (sigHex || '').slice(0, 16),
        bodyLen: bodyRaw.length,
        bodySha256: bodySha,
      });
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
    return next();
  } catch (e) {
    console.error('[webhookAuth:error]', e);
    return res.status(401).json({ error: 'unauthorized' });
  }
}

// ================================================================
// News API （画像はURLパススルー）
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

// 作成（管理画面）— 受け取った images を**そのまま保存**
app.post('/api/news', async (req, res) => {
  try {
    const { title, content, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    const urls = Array.isArray(images) ? images : [];
    const { rows } = await db.query(
      `INSERT INTO news (title, content, image_urls)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [title, content, JSON.stringify(urls)]
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
      clause = ', image_urls = $3';
      params.splice(2, 0, JSON.stringify(images));
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
    const { rowCount } = await db.query(
      `DELETE FROM news WHERE id = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'News not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/news/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook（GAS → サーバー）— 画像は payload.images を**そのまま保存**
app.post('/api/news-webhook', webhookRawJson, webhookAuth, async (req, res) => {
  try {
    const { title, content, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'タイトルと本文は必須です。' });

    const urls = Array.isArray(images) ? images : [];
    const { rows } = await db.query(
      `INSERT INTO news (title, content, image_urls)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [title, content, JSON.stringify(urls)]
    );
    return res.status(201).json({ id: rows[0].id, message: '投稿に成功しました。' });
  } catch (e) {
    console.error('News Webhook Error:', e);
    return res.status(500).json({ error: 'サーバー内部でエラーが発生しました。' });
  }
});

// ================================================================
// Activity API（画像はURLパススルー）
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

    const urls = Array.isArray(images) ? images : [];
    const { rows } = await db.query(
      `INSERT INTO activities (title, content, category, activity_date, image_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, content, category, activity_date, JSON.stringify(urls)]
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
      imageClause = ', image_urls = $5';
      params.splice(4, 0, JSON.stringify(images)); // $5 に image_urls
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

// Webhook（GAS → サーバー）— 画像は payload.images を**そのまま保存**
app.post('/api/activity-webhook', webhookRawJson, webhookAuth, async (req, res) => {
  try {
    const { title, content, category = null, activity_date = null, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'タイトルと本文は必須です。' });

    const urls = Array.isArray(images) ? images : [];
    const { rows } = await db.query(
      `INSERT INTO activities (title, content, category, activity_date, image_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, content, category, activity_date, JSON.stringify(urls)]
    );
    return res.status(201).json({ id: rows[0].id, message: '活動報告の投稿に成功しました。' });
  } catch (e) {
    console.error('Activity Webhook Error:', e);
    return res.status(500).json({ error: 'サーバー内部エラー' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.post('/__hmac_debug', express.raw({ type: 'application/json' }), (req, res) => {
    const ts = req.get('X-Timestamp') || '';
    const secret = process.env.WEBHOOK_SECRET || '';
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    const exp = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`, 'utf8').digest('hex');
    res.json({
      ts,
      bodyChars: raw.length,
      bodyBytes: Buffer.byteLength(raw,'utf8'),
      bodySha256: crypto.createHash('sha256').update(raw,'utf8').digest('hex'),
      expHead: exp.slice(0,16),
      exp
    });
  });
}
// ------------------------------
// 起動
// ------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
