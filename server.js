/**
 * server.js (patched full version)
 * - /api/news の GET を公開 (一覧/詳細)
 * - Webhook 受け口 /api/news-webhook (HMAC 署名検証, Drive画像のサーバー保存)
 * - /uploads 静的配信, 本文サイズ制限, タイムアウト/サイズ上限
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
const db = require('./database.js'); // データベース接続
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- 基本設定 ----
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// セッション
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'sessions'),
    ttl: 86400,
    reapInterval: 86400
  }),
  secret: process.env.SESSION_SECRET || 'a-bad-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// 静的ファイル提供（既存サイト）
app.use(express.static(path.join(__dirname, '/')));

// /uploads の静的配信
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// ---- 認証ミドルウェア ----
const authMiddleware = (req, res, next) => {
  if (req.session.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Authentication required' });
  return res.redirect('/admin/login.html');
};

// ---- セッション系API ----
// ログイン
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
    const admin = stmt.get(username);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, admin.password, (err, result) => {
      if (err || !result) return res.status(401).json({ error: 'Invalid credentials' });
      req.session.user = { id: admin.id, username: admin.username };
      res.json({ message: 'Login successful' });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ログアウト
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Could not log out' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// セッション確認
app.get('/api/session', (req, res) => {
  if (req.session.user) return res.json({ loggedIn: true, user: req.session.user });
  return res.json({ loggedIn: false });
});

// ---- News API ----
// ▼ 公開 GET（一覧/詳細）
app.get('/api/news', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM news ORDER BY created_at DESC');
    const news = stmt.all();
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/news/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM news WHERE id = ?');
    const newsItem = stmt.get(req.params.id);
    if (newsItem) return res.json(newsItem);
    return res.status(404).json({ error: 'News not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ▼ 変更系は認証必須
app.use('/api/news', authMiddleware);

// 新規作成
app.post('/api/news', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
  try {
    const stmt = db.prepare('INSERT INTO news (title, content) VALUES (?, ?)');
    const info = stmt.run(title, content);
    res.status(201).json({ id: info.lastInsertRowid, title, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新
app.put('/api/news/:id', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
  try {
    const stmt = db.prepare('UPDATE news SET title = ?, content = ? WHERE id = ?');
    const info = stmt.run(title, content, req.params.id);
    if (info.changes > 0) return res.json({ id: req.params.id, title, content });
    return res.status(404).json({ error: 'News not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 削除
app.delete('/api/news/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM news WHERE id = ?');
    const info = stmt.run(req.params.id);
    if (info.changes > 0) return res.status(204).send();
    return res.status(404).json({ error: 'News not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Webhook（GAS→サーバー） ----
// HMAC 検証
function verifyHmacSignature({ bodyRaw, timestamp, signature }) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(now - ts) > 300) return false; // 5分以内
  const h = crypto.createHmac('sha256', secret);
  h.update(`${timestamp}.${bodyRaw}`);
  const expected = `sha256=${h.digest('hex')}`;
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function webhookAuth(req, res, next) {
  try {
    const timestamp = req.header('X-Timestamp');
    const signature = req.header('X-Signature');
    const bodyRaw = JSON.stringify(req.body || {});
    if (!verifyHmacSignature({ bodyRaw, timestamp, signature })) {
      return res.status(401).json({ error: 'invalid signature' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// 画像保存（Google系URLのみ許可）
const ALLOWED_HOSTS = new Set(['drive.google.com', 'lh3.googleusercontent.com', 'googleusercontent.com']);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function downloadImageToUploads(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error('invalid url'); }
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error('host not allowed');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);

  const ctype = res.headers.get('content-type') || '';
  if (!ctype.startsWith('image/')) throw new Error('not an image');

  const ext = ctype.split('/')[1]?.split(';')[0] || 'bin';
  const filename = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const fileStream = fs.createWriteStream(filepath, { flags: 'wx' });

  // Web Stream API を使ってデータを正しく処理する
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
        fs.unlinkSync(filepath); // 中途半端なファイルを削除
        throw new Error('file too large');
      }
      fileStream.write(value);
    }
  } finally {
    fileStream.close();
  }

  return { publicPath: `/uploads/${filename}`, contentType: ctype };
}

app.post('/api/news-webhook', webhookAuth, async (req, res) => {
  // 受け取るのは「タイトル」と、画像タグが埋め込まれた「本文HTML」
  const { title, content } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: 'タイトルと本文は必須です。' });
  }

  try {
    // 画像をダウンロードする処理を削除し、受け取った本文をそのまま保存する
    const stmt = db.prepare('INSERT INTO news (title, content) VALUES (?, ?)');
    const info = stmt.run(title, content);
    
    // 成功したことを返す（保存した画像のリストは不要）
    return res.status(201).json({ id: info.lastInsertRowid, message: "投稿に成功しました。" });

  } catch (e) {
    console.error('Webhook処理中にエラーが発生しました:', e);
    return res.status(500).json({ error: 'サーバー内部でエラーが発生しました。' });
  }
});

// ---- 起動 ----
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
