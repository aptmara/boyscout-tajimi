const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== 管理者アカウント情報 ===\n');

db.all('SELECT username, role FROM admins', [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else if (rows.length === 0) {
        console.log('⚠️  管理者アカウントが見つかりません。');
        console.log('\n初期管理者を作成するには、.envファイルに以下を設定してサーバーを再起動してください:');
        console.log('INITIAL_ADMIN_USERNAME=admin');
        console.log('INITIAL_ADMIN_PASSWORD=password123');
    } else {
        console.log('登録されている管理者アカウント:');
        rows.forEach((row, index) => {
            console.log(`${index + 1}. ユーザー名: ${row.username}, 権限: ${row.role}`);
        });
        console.log('\n📍 ログインURL: http://localhost:10000/admin/login');
        console.log('   (サーバーがポート10000で起動している場合)');
    }
    db.close();
});
