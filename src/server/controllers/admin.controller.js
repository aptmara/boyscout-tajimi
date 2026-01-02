const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const db = require('../database');

/**
 * フルバックアップのエクスポート
 * public/uploads ディレクトリと database.sqlite (存在する場合) をZIP圧縮して返す
 */
const downloadBackup = async (req, res) => {
  // レスポンスヘッダー設定
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${timestamp}.zip`;

  res.attachment(filename);

  const archive = archiver('zip', {
    zlib: { level: 9 } // 最高圧縮率
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('[Backup] Warning:', err);
    } else {
      console.error('[Backup] Error:', err);
      // ヘッダー送信後なのでエラーレスポンスは難しいが、ログには残す
    }
  });

  archive.on('error', (err) => {
    console.error('[Backup] Archive Error:', err);
    if (!res.headersSent) {
      res.status(500).send({ error: 'zip_error' });
    } else {
      res.end();
    }
  });

  // パイプ接続
  archive.pipe(res);

  // 1. 画像ディレクトリ (public/uploads)
  const uploadsDir = path.join(__dirname, '../../../public/uploads');
  if (fs.existsSync(uploadsDir)) {
    archive.directory(uploadsDir, 'uploads');
  }

  // 2. SQLiteデータベース (存在する場合)
  // ※ DBロックの問題があるため、本番稼働中にコピーする場合は注意が必要だが、読み取り専用なら概ねOK
  // WALモードなら checkpoint 後が良いが、簡易バックアップとしては許容
  const sqlitePath = path.join(__dirname, '../../../database.sqlite');
  if (fs.existsSync(sqlitePath)) {
    archive.file(sqlitePath, { name: 'database.sqlite' });
  }

  // 3. PostgreSQLの場合のデータダンプ (簡易JSONエクスポート)
  if (!db.useSqlite) {
    try {
      const newsData = await db.query('SELECT * FROM news ORDER BY id DESC');
      archive.append(JSON.stringify(newsData.rows, null, 2), { name: 'db_dump/news.json' });

      const activityData = await db.query('SELECT * FROM activities ORDER BY id DESC');
      archive.append(JSON.stringify(activityData.rows, null, 2), { name: 'db_dump/activities.json' });

      const settingsData = await db.query('SELECT * FROM site_settings ORDER BY key ASC');
      archive.append(JSON.stringify(settingsData.rows, null, 2), { name: 'db_dump/settings.json' });

    } catch (e) {
      console.error('[Backup] DB export failed:', e);
      archive.append(JSON.stringify({ error: e.message }), { name: 'db_dump/error.log' });
    }
  }

  // 完了
  await archive.finalize();
};

module.exports = {
  downloadBackup
};