/**
 * database.js (patched)
 * - 初期セットアップ関数を保持
 * - コマンド実行時のみ close()（コールバック無し）
 */
const sqlite = require('better-sqlite3');
const bcrypt = require('bcrypt');

const db = new sqlite('database.sqlite', { verbose: console.log });

const saltRounds = 10;
const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'password';
const initialUsername = 'admin';

function setupDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Tables "admins" and "news" are ready.');

  const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
  const adminUser = stmt.get(initialUsername);

  if (!adminUser) {
    try {
      const hash = bcrypt.hashSync(initialPassword, saltRounds);
      const insert = db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)');
      insert.run(initialUsername, hash);
      console.log(`Initial admin user "${initialUsername}" created with a temporary password.`);
      console.log('Please change it after first login.');
    } catch (err) {
      console.error('Error creating initial admin user:', err);
    }
  } else {
    console.log(`Admin user "${initialUsername}" already exists.`);
  }
}

if (require.main === module) {
  setupDatabase();
  try {
    db.close();
    console.log('Closed the database connection.');
  } catch (err) {
    console.error('Error closing the database connection:', err);
  }
}

module.exports = db;
module.exports.setupDatabase = setupDatabase;
