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
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const db = require('./database.js');
const { logSecretFingerprint } = require('./utils/logSecretFingerprint');

const app = express();

// === secret fingerprint (ログ最小限)
logSecretFingerprint('WEBHOOK_SECRET', process.env.WEBHOOK_SECRET);

// ------------------------------
// 静的配信・圧縮など（必要に応じ追加）
// ------------------------------
app.use(express.static(path.join(__dirname, '/')));

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
// Webhook用 raw 受信（ルート限定）
// ------------------------------
const webhookRawJson = express.raw({ type: 'application/json', limit: '1mb' });

// グローバル JSON/urlencoded は**Webhookを除外**して適用
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
  if (req.session && req.session.user) return next();
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
  if (req.session && req.session.user) return res.json({ loggedIn: true, user: req.session.user });
  return res.json({ loggedIn: false });
});

// ------------------------------
// HMAC 署名検証（Webhook 用）
// ------------------------------
function verifyHmacSignature({ bodyRaw, timestamp, signature }) {
  const secret = process.env.WEBHOOK_SECRET || '';
  if (!secret) return false;

  const tol = parseInt(process.env.HMAC_TOLERANCE_SEC || '300', 10);
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(String(timestamp || ''), 10);
  if (!ts || Math.abs(now - ts) > tol) return false;

  const m =
    String(signature || '').match(/^sha256=([0-9a-fA-F]{64})$/) ||
    String(signature || '').match(/^([0-9a-fA-F]{64})$/);
  if (!m) return false;
  const gotBuf = Buffer.from(m[1], 'hex');
  if (gotBuf.length !== 32) return false;

  const expBuf = crypto.createHmac('sha256', secret).update(`${ts}.${bodyRaw}`, 'utf8').digest();
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SIG_DEBUG]', {
      expSigHead: expBuf.toString('hex').slice(0,16),
      gotSigHead: gotBuf.toString('hex').slice(0,16),
      ts: String(ts),
      bodyLen: Buffer.byteLength(bodyRaw, 'utf8')
    });
  }
  return gotBuf.length === expBuf.length && crypto.timingSafeEqual(gotBuf, expBuf);
}

function webhookAuth(req, res, next) {
  try {
    const secret = process.env.WEBHOOK_SECRET || '';
    if (!secret) return res.status(500).json({ error: 'server misconfigured' });

    const timestamp = req.get('X-Timestamp');
    const signature = req.get('X-Signature');

    const bodyRaw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body || {});

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
// News API（DB版）
// ================================================================
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

app.use('/api/news', authMiddleware);

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
// Activity API（DB版）
// ================================================================
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

app.use('/api/activities', authMiddleware);

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

app.put('/api/activities/:id', async (req, res) => {
  try {
    const { title, content, category = null, activity_date = null, images = null } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    let imageClause = '';
    const params = [title, content, category, activity_date, req.params.id];
    if (Array.isArray(images)) {
      imageClause = ', image_urls = $5';
      params.splice(4, 0, JSON.stringify(images));
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

// ------------------------------
// /json-api を mount（最後でOK）
// ------------------------------
const jsonApi = require('./server-json');      // Router
app.use('/json-api', jsonApi);

// /uploads をグローバルで公開（server-json.js の保存先を流用）
const UPLOAD_DIR = jsonApi.UPLOAD_DIR;
app.use('/uploads', express.static(UPLOAD_DIR, {
  etag: true,
  maxAge: '7d',
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
