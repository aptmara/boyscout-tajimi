const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const db = require('./database.js'); // データベース接続をインポート
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// -- ミドルウェアの設定 --

// JSONとURLエンコードされたリクエストボディを解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// セッション管理
app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions'), // セッションファイルを保存するディレクトリ
        ttl: 86400, // 1日 (秒)
        reapInterval: 86400 // 1日間隔で期限切れのセッションを削除
    }),
    secret: process.env.SESSION_SECRET || 'a-bad-secret-key', // 環境変数から取得
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS経由でのみクッキーを送信
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1日
    }
}));

// 静的ファイルの提供 (既存のHTML、CSS、JSファイル)
app.use(express.static(path.join(__dirname, '/')));

// -- ルート設定 (今後拡張) --

// 認証ミドルウェア
const authMiddleware = (req, res, next) => {
    if (req.session.user) {
        next(); // ログイン済み
    } else {
        // APIリクエストの場合は401を返し、ページアクセスの場合はログインページにリダイレクト
        if (req.path.startsWith('/api/')) {
            res.status(401).json({ error: 'Authentication required' });
        } else {
            res.redirect('/admin/login.html');
        }
    }
};


// --- APIルート ---

// ログインAPI
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
        const admin = stmt.get(username);

        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        bcrypt.compare(password, admin.password, (err, result) => {
            if (err || !result) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // パスワードが一致した場合、セッションにユーザー情報を保存
            req.session.user = { id: admin.id, username: admin.username };
            res.json({ message: 'Login successful' });
        });
    } catch (dbError) {
        console.error(dbError);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ログアウトAPI
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid'); // セッションクッキーをクリア
        res.json({ message: 'Logout successful' });
    });
});

// セッション状態をチェックするAPI (ログイン状態の確認に使用)
app.get('/api/session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});


// --- News CRUD API ---
// authMiddlewareを適用して、以下のAPIは認証が必要
app.use('/api/news', authMiddleware);

// お知らせ全件取得
app.get('/api/news', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM news ORDER BY created_at DESC');
        const news = stmt.all();
        res.json(news);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// お知らせ一件取得
app.get('/api/news/:id', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM news WHERE id = ?');
        const newsItem = stmt.get(req.params.id);
        if (newsItem) {
            res.json(newsItem);
        } else {
            res.status(404).json({ error: 'News not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// お知らせ新規作成
app.post('/api/news', (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }
    try {
        const stmt = db.prepare('INSERT INTO news (title, content) VALUES (?, ?)');
        const info = stmt.run(title, content);
        res.status(201).json({ id: info.lastInsertRowid, title, content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// お知らせ更新
app.put('/api/news/:id', (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }
    try {
        const stmt = db.prepare('UPDATE news SET title = ?, content = ? WHERE id = ?');
        const info = stmt.run(title, content, req.params.id);
        if (info.changes > 0) {
            res.json({ id: req.params.id, title, content });
        } else {
            res.status(404).json({ error: 'News not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// お知らせ削除
app.delete('/api/news/:id', (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM news WHERE id = ?');
        const info = stmt.run(req.params.id);
        if (info.changes > 0) {
            res.status(204).send(); // No Content
        } else {
            res.status(404).json({ error: 'News not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// -- サーバーの起動 --
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// -- エラーハンドリング --
// 404 Not Found
app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});

// 汎用エラーハンドラ
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
