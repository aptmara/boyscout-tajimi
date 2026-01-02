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


/**
 * ダッシュボード用サマリー情報の取得
 */
const getSummary = async (req, res) => {
  try {
    // ニュース件数
    const newsResult = await db.query('SELECT COUNT(*) as count FROM news');
    const newsCount = parseInt(newsResult.rows[0].count);

    // 活動記録件数
    const activityResult = await db.query('SELECT COUNT(*) as count FROM activities');
    const activityCount = parseInt(activityResult.rows[0].count);

    // 設定状況チェック
    const settingsResult = await db.query('SELECT key, value FROM site_settings');
    const settingsMap = {};
    settingsResult.rows.forEach(r => { settingsMap[r.key] = r.value; });

    // 必須キー（簡易チェック）
    const requiredKeys = [
      { key: 'site_title', label: 'サイトタイトル' },
      { key: 'contact_email', label: 'お問い合わせメールアドレス' }
    ];

    const missingKeys = requiredKeys.filter(k => !settingsMap[k.key] || settingsMap[k.key].trim() === '');

    res.json({
      news: {
        total: newsCount,
        trendLabel: '現在公開中の記事'
      },
      activities: {
        total: activityCount,
        trendLabel: '全期間の記録'
      },
      settings: {
        missingKeys: missingKeys
      }
    });

  } catch (err) {
    console.error('[Admin] Summary Error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
};

module.exports = {
  downloadBackup,
  getSummary
};