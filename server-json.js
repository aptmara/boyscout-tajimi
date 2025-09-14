/**
 * server-json.js
 * Express server using JSON file storage instead of SQLite (for local experiments).
 * Includes:
 *  - Public GET /api/news, /api/news/:id
 *  - Admin session (POST /api/login, /api/logout)
 *  - CRUD (POST/PUT/DELETE /api/news/*) behind session
 *  - Webhook /api/news-webhook (HMAC timestamp signature) + image copy to /uploads
 */

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const storage = require('./news-storage.js');

const router = express.Router();

// ---- middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'sessions'),
    ttl: 86400,
    reapInterval: 86400
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // local
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// static site files (current directory)
app.use(express.static(path.join(__dirname, '/')));

// public uploads
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

const authMiddleware = (req, res, next) => {
  if (req.session.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Authentication required' });
  return res.redirect('/admin/login.html');
};

// --- auth api (very simple for local)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const initialPass = process.env.INITIAL_ADMIN_PASSWORD || 'password';
  if (username === 'admin' && typeof password === 'string' && password === initialPass) {
    req.session.user = { username: 'admin' };
    return res.json({ message: 'Login ok' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/api/session', (req, res) => {
  res.json({ loggedIn: !!req.session.user, user: req.session.user || null });
});

// --- news public GET
app.get('/api/news', (req, res) => {
  try {
    return res.json(storage.list());
  } catch (e) {
    return res.status(500).json({ error: 'read error' });
  }
});

app.get('/api/news/:id', (req, res) => {
  try {
    const item = storage.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'News not found' });
    return res.json(item);
  } catch (e) {
    return res.status(500).json({ error: 'read error' });
  }
});

// --- protected CRUD
app.use('/api/news', authMiddleware);

app.post('/api/news', (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
  try {
    const rec = storage.create({ title, content });
    return res.status(201).json(rec);
  } catch (e) {
    return res.status(500).json({ error: 'write error' });
  }
});

app.put('/api/news/:id', (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
  try {
    const rec = storage.update(req.params.id, { title, content });
    if (!rec) return res.status(404).json({ error: 'News not found' });
    return res.json(rec);
  } catch (e) {
    return res.status(500).json({ error: 'write error' });
  }
});

app.delete('/api/news/:id', (req, res) => {
  try {
    const ok = storage.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'News not found' });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: 'write error' });
  }
});

// --- webhook (HMAC)
function verifyHmacSignature({ bodyRaw, timestamp, signature }) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(now - ts) > 300) return false;
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

// --- image fetch/copy to /uploads
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

  const file = fs.createWriteStream(filepath, { flags: 'wx' });
  let total = 0;
  await new Promise((resolve, reject) => {
    res.body.on('data', chunk => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        res.body.destroy(new Error('file too large'));
        return;
      }
      file.write(chunk);
    });
    res.body.on('end', () => file.end(resolve));
    res.body.on('error', reject);
    file.on('error', reject);
  });

  return { publicPath: `/uploads/${filename}`, contentType: ctype };
}

app.post('/api/news-webhook', webhookAuth, async (req, res) => {
  const { title, content, images = [] } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'missing fields' });
  try {
    const saved = [];
    for (const url of images) {
      try {
        const { publicPath } = await downloadImageToUploads(url);
        saved.push(publicPath);
      } catch (e) {
        console.warn('image skip:', url, e.message);
      }
    }
    const htmlAppend = saved.map(p => `<p><img src="${p}" alt=""></p>`).join('');
    const rec = storage.create({ title, content: content + (htmlAppend ? `\n${htmlAppend}` : '') });
    return res.status(201).json({ id: rec.id, images: saved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
});

// Router を公開（server.js から mount する）
module.exports = router;