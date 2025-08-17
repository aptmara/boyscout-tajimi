const sqlite = require('better-sqlite3');
const bcrypt = require('bcrypt');

const db = new sqlite('database.sqlite', { verbose: console.log });

const saltRounds = 10;
// 環境変数から初期パスワードを取得、なければデフォルト値（開発用）
const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'password';
const initialUsername = 'admin';

function setupDatabase() {
    // adminsテーブルの作成
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

    // newsテーブルの作成
    db.exec(`
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('Tables "admins" and "news" are ready.');

    // 初回管理者ユーザーの確認と作成
    const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
    const adminUser = stmt.get(initialUsername);

    if (!adminUser) {
        try {
            // bcrypt.hashは非同期なので、同期版のhashSyncを使用するか、Promiseで処理を待つ必要があります。
            // CLIスクリプトとしてシンプルに完結させるため、ここでは同期版を使用します。
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

// スクリプトとして直接実行された場合にのみセットアップを実行
if (require.main === module) {
    setupDatabase();
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
}

module.exports = db;
