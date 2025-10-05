// database.js (統合・是正済み)
// - IPv4優先 + SSL
// - 起動DDLはトランザクション + advisory lock で再実行安全
// - site_settings 物理テーブル + 互換VIEW settings（INSTEAD OF TRIGGERで書き込み）
// - news / activities: image_urls は JSONB、unit / tags 追加（JSONB）
// - 必要インデックス作成
// - 初回管理者自動作成（INITIAL_ADMIN_* があれば）

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

// デバッグ: 起動時にDBホストの名前解決結果を出力
(async () => {
  try {
    const host = new URL(connectionString).hostname;
    const a = await dns.promises.resolve4(host);
    console.log('[DB DNS A records]', host, a);
    try {
      const aaaa = await dns.promises.resolve6(host);
      console.log('[DB DNS AAAA records]', host, aaaa);
    } catch {}
  } catch (e) {
    console.warn('[DB DNS resolve warn]', e.message);
  }
})();

// Pool設定（SSL明示 + IPv4 lookup 強制）
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  lookup: lookupIPv4,
  // connectionTimeoutMillis: 10000,
  // idleTimeoutMillis: 30000,
});

// 起動時DDL（存在しなければ作る・不足列は追加）— 再実行安全
async function setupDatabase() {
  const client = await pool.connect();
  const lockKey = 'aptma_schema_setup_v2'; // 同時起動抑止用（任意文字列）
  try {
    // 並行起動対策：アドバイザリロック
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);
    await client.query('BEGIN');

    // 0) マイグレーション記録テーブル（将来拡張用）
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 1) セッションテーブル（connect-pg-simple 用）
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey'
        ) THEN
          ALTER TABLE "session"
            ADD CONSTRAINT "session_pkey"
            PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        END IF;
      END$$;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);

    // 2) 管理者
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

    // 3) news（JSONB列・分類列）
    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_urls JSONB DEFAULT '[]'::jsonb,
        category TEXT,
        unit TEXT,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3-1) 既存スキーマとの差分吸収（何度走っても安全）
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='news' AND column_name='image_urls'
        ) THEN
          ALTER TABLE news ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='news' AND column_name='category'
        ) THEN
          ALTER TABLE news ADD COLUMN category TEXT;
          UPDATE news SET category = '未分類' WHERE category IS NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='news' AND column_name='unit'
        ) THEN
          ALTER TABLE news ADD COLUMN unit TEXT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='news' AND column_name='tags'
        ) THEN
          ALTER TABLE news ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb;
        END IF;
      END$$;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_news_category   ON news (category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_news_unit       ON news (unit);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_news_tags_gin   ON news USING GIN (tags jsonb_path_ops);`);

    // 4) activities（JSONB列・分類/日付）
    await client.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        activity_date DATE,
        image_urls JSONB DEFAULT '[]'::jsonb,
        unit TEXT,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // 旧 image_url → image_urls へ片道移行（残っていれば）
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='activities' AND column_name='image_url'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='activities' AND column_name='image_urls'
          ) THEN
            ALTER TABLE activities ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb;
          END IF;
          UPDATE activities
             SET image_urls = CASE
               WHEN COALESCE(image_url, '') <> '' THEN jsonb_build_array(image_url)
               ELSE COALESCE(image_urls, '[]'::jsonb)
             END
           WHERE image_url IS NOT NULL;
          ALTER TABLE activities DROP COLUMN image_url;
        END IF;
      END$$;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_created_at     ON activities (created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_activity_date  ON activities (activity_date DESC NULLS LAST);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_category       ON activities (category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_unit           ON activities (unit);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_tags_gin       ON activities USING GIN (tags jsonb_path_ops);`);

    // 5) site_settings 物理テーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5-1) 旧 settings テーブルがあれば一度だけ退避（既に退避済みなら何もしない）
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.settings') IS NOT NULL
           AND to_regclass('public.settings_legacy_backup') IS NULL THEN
          EXECUTE 'ALTER TABLE public.settings RENAME TO settings_legacy_backup';
        END IF;
      END
      $$;
    `);

    // 5-2) 退避表が存在する場合、データを site_settings へ片道移行（重複は無視）
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.settings_legacy_backup') IS NOT NULL THEN
          EXECUTE $mig$
            INSERT INTO public.site_settings (key, value, description)
            SELECT key, value, NULL
            FROM public.settings_legacy_backup
            ON CONFLICT (key) DO NOTHING
          $mig$;
        END IF;
      END
      $$;
    `);

    // 5-3) 互換ビュー settings（site_settings を透過利用）
    await client.query(`DROP VIEW IF EXISTS public.settings CASCADE;`);
    await client.query(`
      CREATE VIEW public.settings AS
        SELECT key, value FROM public.site_settings;
    `);

    // 5-4) INSTEAD OF TRIGGER で書き込みを site_settings へ転送
    await client.query(`DROP FUNCTION IF EXISTS public.settings_view_upsert() CASCADE;`);
    await client.query(`
      CREATE FUNCTION public.settings_view_upsert()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF (TG_OP = 'INSERT') THEN
          INSERT INTO public.site_settings(key, value, updated_at)
          VALUES (NEW.key, NEW.value, NOW())
          ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW();
          RETURN NEW;
        ELSIF (TG_OP = 'UPDATE') THEN
          UPDATE public.site_settings
             SET value = NEW.value,
                 updated_at = NOW()
           WHERE key = NEW.key;
          RETURN NEW;
        ELSE
          RETURN NEW;
        END IF;
      END;
      $$;
    `);
    await client.query(`DROP TRIGGER IF EXISTS settings_view_upsert_trg ON public.settings;`);
    await client.query(`
      CREATE TRIGGER settings_view_upsert_trg
      INSTEAD OF INSERT OR UPDATE ON public.settings
      FOR EACH ROW EXECUTE FUNCTION public.settings_view_upsert();
    `);

    // 5-5) 初期データ（既存キーは維持）
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
        ('index_testimonial_img_2_url', '', 'トップの体験談プロフィール画像2 URL'),

        -- マスタ：隊とタグ候補
        ('units_json', '[
          {"label":"ビーバー","slug":"beaver"},
          {"label":"カブ","slug":"cub"},
          {"label":"ボーイ","slug":"boy"},
          {"label":"ベンチャー","slug":"venture"},
          {"label":"ローバー","slug":"rover"}
        ]', '隊別（JSON配列: {label,slug}）'),
        ('news_tags_json', '[
          {"label":"お知らせ","slug":"announce"},
          {"label":"重要","slug":"important"},
          {"label":"募集","slug":"recruit"},
          {"label":"メディア","slug":"media"},
          {"label":"安全","slug":"safety"}
        ]', 'ニュース用タグ候補（JSON配列: {label,slug}）'),
        ('activity_tags_json', '[
          {"label":"キャンプ","slug":"camp"},
          {"label":"ハイク","slug":"hike"},
          {"label":"奉仕","slug":"service"},
          {"label":"訓練","slug":"training"},
          {"label":"式典","slug":"ceremony"}
        ]', '活動用タグ候補（JSON配列: {label,slug}）')
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query('COMMIT');
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
    console.log('Tables are ready.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    try { await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]); } catch {}
    console.error('Error during database setup:', err);
    throw err;
  } finally {
    client.release();
  }

  // --- オプション: 初回管理者自動作成（トランザクション外でOK） ---
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
}

// 共通 query
function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  query,
  setupDatabase,
  getClient: () => pool.connect(),
  pool, // connect-pg-simple 用
};
