// database.js (Supabase / Postgres, server.js と整合)
// - pg Pool を使用
// - SSL を明示（DATABASE_URL に sslmode=require が無い環境でも動かす）
// - news / activities ともに image_urls を JSONB で作成
// - 必要インデックス作成
// - オプション: 初回管理者自動作成（INITIAL_ADMIN_* があれば）

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
}

// Supabase環境でのSSL対策：DATABASE_URLにsslmode=requireが無くても接続できるようにする
const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false, // Supabaseの証明書を信頼（Render等のPaaSでも安定）
    },
    // idleTimeoutMillis / connectionTimeoutMillis は必要に応じて調整
    // idleTimeoutMillis: 30000,
    // connectionTimeoutMillis: 10000,
});

// 起動時DDL（存在しなければ作る・不足列は追加）
async function setupDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // admins
        await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

        // news
        await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_urls JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        // 後方互換: 既存newsにimage_urlsが無ければ追加
        await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='news' AND column_name='image_urls'
        ) THEN
          ALTER TABLE news ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb;
        END IF;
      END$$;
    `);
        // 並び順に使う created_at へインデックス
        await client.query(`CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);`);

        // activities
        await client.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        activity_date DATE,
        image_urls JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        // 後方互換: 旧 image_url TEXT を使っていた場合の移行（存在すればimage_urlsへ変換・取り込み）
        await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='activities' AND column_name='image_url'
        ) THEN
          -- image_urls が無ければ追加
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='activities' AND column_name='image_urls'
          ) THEN
            ALTER TABLE activities ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb;
          END IF;

          -- image_url が埋まっている行を image_urls へ移行（先頭要素として）
          UPDATE activities
             SET image_urls = CASE
                 WHEN COALESCE(image_url, '') <> '' THEN jsonb_build_array(image_url)
                 ELSE COALESCE(image_urls, '[]'::jsonb)
               END
           WHERE image_url IS NOT NULL;

          -- 旧カラム削除
          ALTER TABLE activities DROP COLUMN image_url;
        END IF;
      END$$;
    `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_activity_date ON activities (activity_date DESC NULLS LAST);`);

        await client.query('COMMIT');
        console.log('Tables are ready.');

        // --- オプション: 初回管理者自動作成 ---
        // 環境変数があれば、存在しない場合のみ作成する（本番では最初に一度だけセット）
        const adminUser = process.env.INITIAL_ADMIN_USERNAME;
        const adminPass = process.env.INITIAL_ADMIN_PASSWORD;
        if (adminUser && adminPass) {
            const { rows } = await pool.query(`SELECT 1 FROM admins WHERE username = $1`, [adminUser]);
            if (rows.length === 0) {
                const hash = await bcrypt.hash(adminPass, 12);
                await pool.query(`INSERT INTO admins (username, password) VALUES ($1, $2)`, [adminUser, hash]);
                console.log(`Admin user '${adminUser}' created.`);
            }
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during database setup:', err);
        throw err;
    } finally {
        client.release();
    }
}

// 共通 query
function query(text, params) {
    return pool.query(text, params);
}

module.exports = {
    query,
    setupDatabase,
    // 必要なら graceful shutdown 用:
    // end: () => pool.end(),
};
