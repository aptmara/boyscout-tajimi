// database.js (Supabase / Postgres, server.js と整合)
// - pg Pool を使用
// - SSL を明示（DATABASE_URL に sslmode=require が無い環境でも動かす）
// - news / activities ともに image_urls を JSONB で作成
// - 必要インデックス作成
// - オプション: 初回管理者自動作成（INITIAL_ADMIN_* があれば）

require('dotenv').config();
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');

function lookupIPv4(hostname, _opts, cb) {
  return dns.lookup(hostname, { family: 4, all: false }, cb);
}

// デバッグ: 起動時に名前解決結果を一度出す
(async () => {
  try {
    const host = new URL(connectionString).hostname;
    const a = await dns.promises.resolve4(host);
    console.log('[DB DNS A records]', host, a);
    // AAAAが返ってくるかも見る
    try {
      const aaaa = await dns.promises.resolve6(host);
      console.log('[DB DNS AAAA records]', host, aaaa);
    } catch {}
  } catch (e) {
    console.warn('[DB DNS resolve warn]', e.message);
  }
})();

// Pool設定：ssl明示 + IPv4 lookup 強制
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  lookup: lookupIPv4, // ← これでIPv4のみ使用
  // connectionTimeoutMillis: 10000,
  // idleTimeoutMillis: 30000,
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

        // サイト設定テーブル
        await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT, -- 管理画面用の説明
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        // 設定項目の初期データを挿入
        await client.query(`
      INSERT INTO site_settings (key, value, description) VALUES
        -- 連絡先
        ('contact_address', '〒XXX-XXXX 岐阜県多治見市XX町X-X-X', 'フッターや連絡先ページに表示する住所'),
        ('contact_phone', '0572-XX-XXXX', 'フッターや連絡先ページに表示する代表電話番号'),
        ('contact_secondary_phone', '0572-00-0000', '連絡先のサブ電話番号'),
        ('contact_email', 'info@bs-tajimi1.example.jp', 'フッターや連絡先ページに表示するメールアドレス'),
        ('contact_person_name', '', 'お問い合わせ担当者名（表示用）'),

        -- 各隊リーダー名
        ('leader_beaver', '佐藤 愛', 'ビーバー隊リーダー名'),
        ('leader_cub', '鈴木 一郎', 'カブ隊リーダー名'),
        ('leader_boy', '渡辺 健', 'ボーイ隊隊長名'),
        ('leader_venture', '伊藤 誠', 'ベンチャー隊隊長名'),
        ('leader_rover', '高橋 明', 'ローバー隊アドバイザー名'),

        -- プライバシーポリシー用
        ('privacy_contact_person', '', 'プライバシーポリシー：お問い合わせ窓口担当'),
        ('privacy_contact_phone', '', 'プライバシーポリシー：窓口電話番号'),
        ('privacy_contact_email', '', 'プライバシーポリシー：窓口メールアドレス'),
        ('privacy_effective_date', '2025年5月12日', 'プライバシーポリシー：制定日'),
        ('privacy_last_updated_date', '2025年5月12日', 'プライバシーポリシー：最終更新日'),

        -- お問い合わせページ（Googleマップ埋め込み）
        ('contact_map_embed_html', '', 'お問い合わせページに表示するGoogleマップ埋め込みHTML'),

        -- トップページ画像
        ('index_hero_image_url', '', 'トップページのヒーロー画像URL'),
        ('index_highlight_img_1_url', '', '活動ハイライト1の画像URL'),
        ('index_highlight_img_2_url', '', '活動ハイライト2の画像URL'),
        ('index_highlight_img_3_url', '', '活動ハイライト3の画像URL'),
        ('index_testimonial_img_1_url', '', 'トップの体験談プロフィール画像1 URL'),
        ('index_testimonial_img_2_url', '', 'トップの体験談プロフィール画像2 URL')
      ON CONFLICT (key) DO NOTHING;
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
    getClient: () => pool.connect(),
};
