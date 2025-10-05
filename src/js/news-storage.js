/**
 * news-storage.js
 * Simple JSON file-based storage for news items (for local experiments).
 * NOT for production use.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'news.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ lastId: 0, items: [] }, null, 2), 'utf-8');
  }
}

function readAll() {
  ensureDataFile();
  const raw = fs.readFileSync(FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeAll(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function list() {
  const db = readAll();
  // newest first
  return db.items.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function get(id) {
  const db = readAll();
  return db.items.find(x => String(x.id) === String(id)) || null;
}

function create({ title, content }) {
  const db = readAll();
  const id = ++db.lastId;
  const now = new Date().toISOString();
  const rec = { id, title, content, created_at: now };
  db.items.push(rec);
  writeAll(db);
  return rec;
}

function update(id, { title, content }) {
  const db = readAll();
  const idx = db.items.findIndex(x => String(x.id) === String(id));
  if (idx === -1) return null;
  db.items[idx].title = title;
  db.items[idx].content = content;
  writeAll(db);
  return db.items[idx];
}

function remove(id) {
  const db = readAll();
  const before = db.items.length;
  db.items = db.items.filter(x => String(x.id) !== String(id));
  writeAll(db);
  return db.items.length !== before;
}

module.exports = { list, get, create, update, remove, FILE, DATA_DIR };
