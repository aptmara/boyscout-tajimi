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
app.set('trust proxy', 1);
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
// Helpers: slug/tags normalize
// ------------------------------
function normalizeSlug(s) {
  return String(s || '').trim().toLowerCase();
}
function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input.map(normalizeSlug).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(/[\s,]+/).map(normalizeSlug).filter(Boolean);
  }
  return [];
}

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


// ===== Settings API (互換) =====

app.get(['/api/settings','/api/settings/all'], authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings ORDER BY key ASC');
    if (req.path.endsWith('/all')) {
      // admin/settings.html は配列 [{key,value},...] を期待
      return res.status(200).json(rows);
    } else {
      // 互換: マップ { key: value, ... }
      const obj = {};
      for (const r of rows) obj[r.key] = r.value ?? '';
      return res.status(200).json(obj);
    }
  } catch (err) {
    console.error(`GET ${req.path} error:`, err);
    res.status(500).json({ error: 'failed_to_fetch_settings' });
  }
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const [k, v] of Object.entries(body)) {
        if (typeof k !== 'string' || !k.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'invalid_key' });
        }
        const val = (v === null || v === undefined) ? '' : String(v);

        // 重要：ビュー(settings)には ON CONFLICT を使うな
        // 1) UPDATE（INSTEAD OF UPDATE トリガ経由で site_settings へ反映）
        const upd = await client.query(
          `UPDATE settings SET value = $2 WHERE key = $1`,
          [k, val]
        );

        // 2) 更新0件なら INSERT（INSTEAD OF INSERT トリガ経由で upsert）
        if (upd.rowCount === 0) {
          await client.query(
            `INSERT INTO settings(key, value) VALUES ($1, $2)`,
            [k, val]
          );
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('PUT /api/settings error:', e);
      // デバッグ用に message を返す（本番で気になるなら消してよい）
      return res.status(500).json({ error: 'failed_to_update_settings', detail: e.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('PUT /api/settings error (outer):', err);
    return res.status(500).json({ error: 'failed_to_update_settings' });
  }
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
    const { category, unit, tags, tags_any, limit, offset } = req.query || {};
    const lim = Math.min(parseInt(limit || '20', 10), 100);
    const off = Math.max(parseInt(offset || '0', 10), 0);

    const where = [];
    const params = [];

    if (category && String(category).trim()) {
      params.push(String(category).trim());
      where.push(`category = $${params.length}`);
    }
    if (unit && String(unit).trim()) {
      params.push(normalizeSlug(unit));
      where.push(`unit = $${params.length}`);
    }
    if (tags && String(tags).trim()) {
      const t = normalizeTags(tags);
      if (t.length) {
        params.push(JSON.stringify(t));
        where.push(`tags @> $${params.length}::jsonb`);
      }
    }
    if (!tags && tags_any && String(tags_any).trim()) {
      // Optional OR search across tags
      const anyList = normalizeTags(tags_any);
      if (anyList.length) {
        params.push(anyList);
        where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) z WHERE z.value = ANY($${params.length}))`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(lim, off);
    const { rows } = await db.query(
      `SELECT id, title, content, image_urls, category, unit, tags, created_at
         FROM news
         ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json(rows);
  } catch (e) {
    console.error('GET /api/news error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, image_urls, category, unit, tags, created_at
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
    const { title, content, images = [], category = null, unit = null, tags = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    const urls = Array.isArray(images) ? images : [];
    const uni = unit ? normalizeSlug(unit) : null;
    const tgs = normalizeTags(tags);
    const { rows } = await db.query(
      `INSERT INTO news (title, content, image_urls, category, unit, tags)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)
       RETURNING id`,
      [title, content, JSON.stringify(urls), category, uni, JSON.stringify(tgs)]
    );
    res.status(201).json({ id: rows[0].id, message: 'Created' });
  } catch (err) {
    console.error('POST /api/news error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/news/:id', async (req, res) => {
  try {
    const { title, content, images = null, category = null, unit = null, tags = null } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    let clause = '';
    const params = [title, content, category, unit ? normalizeSlug(unit) : null, req.params.id];
    if (Array.isArray(images)) {
      clause += ', image_urls = $3';
      params.splice(2, 0, JSON.stringify(images));
    }
    if (tags) {
      clause += ', tags = $' + (clause ? 4 : 3);
      // adjust index if images was present
      const idx = images ? 4 : 3;
      params.splice(idx - 1, 0, JSON.stringify(normalizeTags(tags)));
    }

    const { rowCount } = await db.query(
      `UPDATE news
       SET title = $1,
           content = $2,
           category = $3,
           unit = $4
           ${clause}
       WHERE id = $${clause ? (images ? 6 : 5) : 5}`,
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

// News WebHook（GAS からの投稿）：title, content, images[], category? を受け取る
app.post('/api/news-webhook', webhookRawJson, webhookAuth, async (req, res) => {
  try {
    const { title, content, images, category, unit, tags } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

    const imgs = Array.isArray(images) ? images : [];
    const cat  = (category && String(category).trim()) || '未分類';
    const uni  = normalizeSlug(unit);
    const tgs  = normalizeTags(tags);

    await db.query(
      `INSERT INTO news (title, content, image_urls, category, unit, tags)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)`,
      [String(title), String(content), JSON.stringify(imgs), cat, uni || null, JSON.stringify(tgs)]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('news-webhook error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});


// ================================================================
// Activity API（DB版）
// ================================================================
app.get('/api/activities', async (req, res) => {
  try {
    const { category, unit, tags, tags_any, limit, offset } = req.query || {};
    const lim = Math.min(parseInt(limit || '20', 10), 100);
    const off = Math.max(parseInt(offset || '0', 10), 0);

    const where = [];
    const params = [];
    if (category && String(category).trim()) {
      params.push(String(category).trim());
      where.push(`category = $${params.length}`);
    }
    if (unit && String(unit).trim()) {
      params.push(normalizeSlug(unit));
      where.push(`unit = $${params.length}`);
    }
    if (tags && String(tags).trim()) {
      const t = normalizeTags(tags);
      if (t.length) {
        params.push(JSON.stringify(t));
        where.push(`tags @> $${params.length}::jsonb`);
      }
    }
    if (!tags && tags_any && String(tags_any).trim()) {
      const anyList = normalizeTags(tags_any);
      if (anyList.length) {
        params.push(anyList);
        where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) z WHERE z.value = ANY($${params.length}))`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(lim, off);
    const { rows } = await db.query(
      `SELECT id, title, content, image_urls, category, unit, tags, activity_date, created_at
         FROM activities
         ${whereSql}
        ORDER BY COALESCE(activity_date, created_at) DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json(rows);
  } catch (e) {
    console.error('GET /api/activities error:', e);
    return res.status(500).json({ error: 'server_error' });
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
    const { title, content, category = null, unit = null, tags = [], activity_date = null, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    const urls = Array.isArray(images) ? images : [];
    const uni = unit ? normalizeSlug(unit) : null;
    const tgs = normalizeTags(tags);
    const { rows } = await db.query(
      `INSERT INTO activities (title, content, category, unit, tags, activity_date, image_urls)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id`,
      [title, content, category, uni, JSON.stringify(tgs), activity_date, JSON.stringify(urls)]
    );
    res.status(201).json({ id: rows[0].id, message: 'Created' });
  } catch (err) {
    console.error('POST /api/activities error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/activities/:id', async (req, res) => {
  try {
    const { title, content, category = null, unit = null, tags = null, activity_date = null, images = null } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    let imageClause = '';
    let tagsClause = '';
    const params = [title, content, category, unit ? normalizeSlug(unit) : null, activity_date, req.params.id];
    if (Array.isArray(images)) {
      imageClause = ', image_urls = $6';
      params.splice(5, 0, JSON.stringify(images));
    }
    if (tags) {
      tagsClause = ', tags = $' + (imageClause ? 7 : 6);
      params.splice(imageClause ? 6 : 5, 0, JSON.stringify(normalizeTags(tags)));
    }

    const { rowCount } = await db.query(
      `UPDATE activities
       SET title = $1,
           content = $2,
           category = $3,
           unit = $4,
           activity_date = $5
           ${imageClause}
           ${tagsClause}
       WHERE id = $${imageClause ? (tagsClause ? 8 : 7) : (tagsClause ? 7 : 6)}`,
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

// Activity WebHook：title, content, images[], category?, activity_date? を受け取る
app.post('/api/activity-webhook', webhookRawJson, webhookAuth, async (req, res) => {
  try {
    const { title, content, images, category, unit, tags, activity_date } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

    const imgs = Array.isArray(images) ? images : [];
    const cat  = (category && String(category).trim()) || '未分類';
    const uni  = normalizeSlug(unit);
    const tgs  = normalizeTags(tags);
    const ad   = activity_date ? new Date(activity_date) : null;

    await db.query(
      `INSERT INTO activities (title, content, image_urls, category, unit, tags, activity_date)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7)`,
      [String(title), String(content), JSON.stringify(imgs), cat, uni || null, JSON.stringify(tgs), ad]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('activity-webhook error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});


// ================================================================
// Settings API (修正版)
// ================================================================

// GET /api/settings - 設定を取得
// (admin/settings.html が実際に使用する /api/settings/all のエイリアスとしても機能)
app.get(['/api/settings', '/api/settings/all'], authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings');
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) {
    console.error(`GET ${req.path} error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 公開用の設定（認証不要）。サイト表示に必要な最低限のキーのみ返す
app.get('/api/public-settings', async (req, res) => {
  try {
    const publicKeys = [
      // 連絡先・フッター
      'contact_address',
      'contact_phone',
      'contact_secondary_phone',
      'contact_email',
      'contact_person_name',
      'contact_map_embed_html',
      // 各部門リーダー名
      'leader_beaver',
      'leader_cub',
      'leader_boy',
      'leader_venture',
      'leader_rover',
      // プライバシーポリシー（サイトに表示）
      'privacy_contact_person',
      'privacy_contact_phone',
      'privacy_contact_email',
      'privacy_effective_date',
      'privacy_last_updated_date',
      // トップページ画像
      'index_hero_image_url',
      'index_highlight_img_1_url',
      'index_highlight_img_2_url',
      'index_highlight_img_3_url',
      'index_testimonial_img_1_url',
      'index_testimonial_img_2_url',
    ];

    const placeholders = publicKeys.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await db.query(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
      publicKeys
    );

    const obj = {};
    for (const r of rows) obj[r.key] = r.value ?? '';
    return res.status(200).json(obj);
  } catch (err) {
    console.error('GET /api/public-settings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings - 設定を保存
app.post('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { site_title, contact_email } = req.body;
    if (typeof site_title === 'undefined' || typeof contact_email === 'undefined') {
      return res.status(400).json({ error: 'site_title and contact_email are required.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('site_title', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [site_title]
      );
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('contact_email', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [contact_email]
      );
      await client.query('COMMIT');
      res.json({ message: 'Settings updated successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /api/settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
