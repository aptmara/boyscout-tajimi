// database.js (Modified for SQLite support)
require('dotenv').config();
const dns = require('node:dns');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Check if we should use SQLite
// We use SQLite if DATABASE_URL is not set OR if it starts with 'sqlite:'
const dbUrl = process.env.DATABASE_URL || '';
const useSqlite = !dbUrl || dbUrl.startsWith('sqlite:') || dbUrl.includes('localhost') && !dbUrl.includes('postgres'); // Fallback logic

let pool;
let query;
let setupDatabase;
let getClient;

if (useSqlite) {
  console.log('Using SQLite for local development.');
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '../../database.sqlite');
  const db = new sqlite3.Database(dbPath);

  // Wrapper to mimic pg's query interface
  query = (text, params = []) => {
    return new Promise((resolve, reject) => {
      // Convert $1, $2, ... to ?
      let sql = text.replace(/\$\d+/g, '?');

      // Handle RETURNING clause (SQLite doesn't support it fully in older versions, but we can fake it or use lastID)
      // For simple INSERT ... RETURNING id, we can use this.lastID
      const isInsert = /^\s*INSERT\s+/i.test(sql);
      const isUpdate = /^\s*UPDATE\s+/i.test(sql);
      const isDelete = /^\s*DELETE\s+/i.test(sql);
      const hasReturning = /RETURNING\s+id/i.test(sql);

      if (hasReturning) {
        sql = sql.replace(/RETURNING\s+.*$/i, '');
      }

      if (isInsert || isUpdate || isDelete) {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          // Mimic pg result
          const rows = [];
          if (isInsert && hasReturning) {
            rows.push({ id: this.lastID });
          }
          resolve({ rows, rowCount: this.changes });
        });
      } else {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows, rowCount: rows.length });
        });
      }
    });
  };

  getClient = async () => {
    // Mimic pg client
    return {
      query: query,
      release: () => { },
    };
  };

  setupDatabase = async () => {
    console.log('Setting up SQLite database...');
    const run = (sql) => new Promise((resolve, reject) => db.run(sql, (err) => err ? reject(err) : resolve()));

    // Simplified Schema for SQLite
    await run(`CREATE TABLE IF NOT EXISTS session (sid TEXT PRIMARY KEY, sess TEXT, expire TEXT)`);
    await run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);

    await run(`CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_urls TEXT DEFAULT '[]',
      category TEXT,
      unit TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      activity_date TEXT,
      image_urls TEXT DEFAULT '[]',
      unit TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Initial Admin
    const adminUser = process.env.INITIAL_ADMIN_USERNAME;
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD;

    console.log(`[Startup] Checking admin seeding configuration...`);
    if (adminUser && adminPass) {
      try {
        console.log(`[Startup] Initial admin configured. Checking if user '${adminUser}' exists...`);
        const { rows } = await query(`SELECT 1 FROM admins WHERE username = $1`, [adminUser]);
        if (rows.length === 0) {
          console.log(`[Startup] Admin '${adminUser}' not found. Creating...`);
          const hash = await bcrypt.hash(adminPass, 12);
          await query(`INSERT INTO admins (username, password) VALUES ($1, $2)`, [adminUser, hash]);
          console.log(`[Startup] Admin user '${adminUser}' created successfully.`);
        } else {
          console.log(`[Startup] Admin '${adminUser}' already exists. Skipping creation.`);
        }
      } catch (e) {
        console.error('[Startup] Failed to seed admin user:', e);
      }
    } else {
      console.log('[Startup] INITIAL_ADMIN_USERNAME or PASSWORD not set. Skipping admin seeding.');
    }

    // SQLite用：site_settings初期データ挿入
    console.log('[Startup] Seeding site_settings...');
    const initialSettings = [
      ['contact_address', '〒507-0017 岐阜県多治見市長瀬町２４番地の３１', 'フッターや連絡先ページに表示する住所'],
      ['contact_phone', '0572-XX-XXXX', 'フッターや連絡先ページに表示する代表電話番号'],
      ['contact_email', 'tajimi1@gifu.scout.jp', 'フッターや連絡先ページに表示するメールアドレス'],
      ['contact_person_name', '団委員長', '問い合わせ担当者名'],
      ['contact_secondary_phone', '', '問い合わせ用電話番号（担当者直通など）'],
      ['contact_map_embed_html', '', 'Google Maps埋め込みHTML'],
      ['leader_beaver', '（設定なし）', 'ビーバー隊リーダー名'],
      ['leader_cub', '（設定なし）', 'カブ隊リーダー名'],
      ['leader_boy', '（設定なし）', 'ボーイ隊隊長名'],
      ['leader_venture', '（設定なし）', 'ベンチャー隊隊長名'],
      ['leader_rover', '（設定なし）', 'ローバー隊アドバイザー名'],
      ['privacy_contact_person', '団委員長', 'プライバシーポリシー担当者'],
      ['privacy_contact_phone', '', 'プライバシー担当電話番号'],
      ['privacy_contact_email', '', 'プライバシー担当メールアドレス'],
      ['privacy_effective_date', '2025年5月12日', 'プライバシーポリシー施行日'],
      ['privacy_last_updated_date', '2025年5月12日', 'プライバシーポリシー最終更新日'],
      ['about_mission_image_url', 'https://placehold.co/600x400/38A169/FFFFFF?text=団活動の様子+理念', '団について：理念セクション画像'],
      ['about_safety_image_url', 'https://placehold.co/600x450/A5D6A7/FFFFFF?text=安全な活動の+イメージ', '団について：安全セクション画像'],
      ['join_features_image_url', 'https://placehold.co/600x450/F9A825/FFFFFF?text=多治見第一団の特色イメージ', '入団案内ページの特色セクション画像'],
    ];
    for (const [key, value, description] of initialSettings) {
      try {
        await run(`INSERT OR IGNORE INTO site_settings (key, value, description) VALUES ('${key}', '${value}', '${description}')`);
      } catch (e) {
        console.error(`[Startup] Failed to insert setting '${key}':`, e.message);
      }
    }
    console.log('[Startup] site_settings seeded.');

    // SQLite Migration for Performance
    try {
      const columns = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(activities)", (err, rows) => err ? reject(err) : resolve(rows));
      });
      const hasDisplayDate = columns.some(c => c.name === 'display_date');

      if (!hasDisplayDate) {
        console.log('[Startup] Migrating SQLite schema (adding display_date)...');
        await run(`ALTER TABLE activities ADD COLUMN display_date TEXT`);
        await run(`UPDATE activities SET display_date = COALESCE(activity_date, created_at)`);

        await run(`ALTER TABLE news ADD COLUMN display_date TEXT`);
        await run(`UPDATE news SET display_date = created_at`);
        console.log('[Startup] SQLite migration completed.');
      }

      // SQLite Indexes
      await run(`CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_activities_unit ON activities(unit)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_activities_display_date ON activities(display_date DESC)`);

      await run(`CREATE INDEX IF NOT EXISTS idx_news_category ON news(category)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_news_unit ON news(unit)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_news_display_date ON news(display_date DESC)`);

    } catch (e) {
      console.error('[Startup] SQLite migration error:', e);
    }

    console.log('SQLite tables ready.');
  };

  pool = {
    query,
    connect: getClient,
    // Mock for connect-pg-simple if it tries to use pool
    // But we will switch to session-file-store in server.js
  };

} else {
  // PostgreSQL Implementation (Original)
  dns.setDefaultResultOrder('ipv4first');
  const { Pool } = require('pg');

  function lookupIPv4(hostname, _opts, cb) {
    return dns.lookup(hostname, { family: 4, all: false }, cb);
  }

  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    lookup: lookupIPv4,
  });

  query = (text, params) => pool.query(text, params);
  getClient = () => pool.connect();

  setupDatabase = async () => {
    const client = await pool.connect();
    const lockKey = 'aptma_schema_setup_v2';
    try {
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);
      await client.query('BEGIN');

      // 0) schema_migrations
      await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

      // 1) session
      await client.query(`CREATE TABLE IF NOT EXISTS "session" ("sid" varchar NOT NULL COLLATE "default", "sess" json NOT NULL, "expire" timestamp(6) NOT NULL) WITH (OIDS=FALSE);`);
      await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE; END IF; END$$;`);
      await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);

      // 2) admins
      await client.query(`CREATE TABLE IF NOT EXISTS admins (id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT);`);

      // 3) news
      await client.query(`CREATE TABLE IF NOT EXISTS news (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, image_urls JSONB DEFAULT '[]'::jsonb, category TEXT, unit TEXT, tags JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);

      // 3-1) news migration
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news' AND column_name='image_urls') THEN ALTER TABLE news ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news' AND column_name='category') THEN ALTER TABLE news ADD COLUMN category TEXT; UPDATE news SET category = '未分類' WHERE category IS NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news' AND column_name='unit') THEN ALTER TABLE news ADD COLUMN unit TEXT; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news' AND column_name='tags') THEN ALTER TABLE news ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb; END IF;
        END$$;
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);`);

      // 4) activities
      await client.query(`CREATE TABLE IF NOT EXISTS activities (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT, activity_date DATE, image_urls JSONB DEFAULT '[]'::jsonb, unit TEXT, tags JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);

      // 4-1) activities migration
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='image_url') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='image_urls') THEN ALTER TABLE activities ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb; END IF;
            UPDATE activities SET image_urls = CASE WHEN COALESCE(image_url, '') <> '' THEN jsonb_build_array(image_url) ELSE COALESCE(image_urls, '[]'::jsonb) END WHERE image_url IS NOT NULL;
            ALTER TABLE activities DROP COLUMN image_url;
          END IF;
        END$$;
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at DESC);`);

      // 5) site_settings
      await client.query(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT, description TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);

      // 6) contacts
      await client.query(`CREATE TABLE IF NOT EXISTS contacts (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, subject TEXT, message TEXT NOT NULL, status TEXT DEFAULT 'unread', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts (created_at DESC);`);

      // 6-1) contacts migration
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='phone') THEN ALTER TABLE contacts ADD COLUMN phone TEXT; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='subject') THEN ALTER TABLE contacts ADD COLUMN subject TEXT; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='status') THEN ALTER TABLE contacts ADD COLUMN status TEXT DEFAULT 'unread'; END IF;
        END$$;
      `);

      // 5-1 to 5-4) settings migration & view
      await client.query(`DROP VIEW IF EXISTS public.settings CASCADE;`);
      await client.query(`CREATE VIEW public.settings AS SELECT key, value FROM public.site_settings;`);

      await client.query(`
        CREATE OR REPLACE FUNCTION public.settings_view_upsert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF (TG_OP = 'INSERT') THEN INSERT INTO public.site_settings(key, value, updated_at) VALUES (NEW.key, NEW.value, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(); RETURN NEW;
          ELSIF (TG_OP = 'UPDATE') THEN UPDATE public.site_settings SET value = NEW.value, updated_at = NOW() WHERE key = NEW.key; RETURN NEW;
          ELSE RETURN NEW; END IF;
        END; $$;
      `);
      await client.query(`DROP TRIGGER IF EXISTS settings_view_upsert_trg ON public.settings;`);
      await client.query(`CREATE TRIGGER settings_view_upsert_trg INSTEAD OF INSERT OR UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.settings_view_upsert();`);

      // 5-5) Initial data
      await client.query(`
        INSERT INTO site_settings (key, value, description) VALUES
          ('contact_address', '〒507-0017 岐阜県多治見市長瀬町２４番地の３１', 'フッターや連絡先ページに表示する住所'),
          ('contact_phone', '0572-XX-XXXX', 'フッターや連絡先ページに表示する代表電話番号'),
          ('contact_email', 'tajimi1@gifu.scout.jp', 'フッターや連絡先ページに表示するメールアドレス'),
          ('contact_person_name', '団委員長', '問い合わせ担当者名'),
          ('contact_secondary_phone', '', '問い合わせ用電話番号（担当者直通など）'),
          ('contact_map_embed_html', '', 'Google Maps埋め込みHTML'),
          ('leader_beaver', '（設定なし）', 'ビーバー隊リーダー名'),
          ('leader_cub', '（設定なし）', 'カブ隊リーダー名'),
          ('leader_boy', '（設定なし）', 'ボーイ隊隊長名'),
          ('leader_venture', '（設定なし）', 'ベンチャー隊隊長名'),
          ('leader_rover', '（設定なし）', 'ローバー隊アドバイザー名'),
          ('privacy_contact_person', '団委員長', 'プライバシーポリシー担当者'),
          ('privacy_contact_phone', '', 'プライバシー担当電話番号'),
          ('privacy_contact_email', '', 'プライバシー担当メールアドレス'),
          ('privacy_effective_date', '2025年5月12日', 'プライバシーポリシー施行日'),
          ('privacy_last_updated_date', '2025年5月12日', 'プライバシーポリシー最終更新日')
        ON CONFLICT (key) DO NOTHING;
      `);

      await client.query('COMMIT');
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
      console.log('Tables are ready (Postgres).');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { }
      try { await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]); } catch { }
      console.error('Error during database setup:', err);
      throw err;
    } finally {
      client.release();
    }

    // Admin creation
    const adminUser = process.env.INITIAL_ADMIN_USERNAME;
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD;

    console.log(`[Startup] (PG) Checking admin seeding configuration...`);
    if (adminUser && adminPass) {
      try {
        console.log(`[Startup] (PG) Initial admin configured. Checking if user '${adminUser}' exists...`);
        const { rows } = await pool.query(`SELECT 1 FROM admins WHERE username = $1`, [adminUser]);
        if (rows.length === 0) {
          console.log(`[Startup] (PG) Admin '${adminUser}' not found. Creating...`);
          const hash = await bcrypt.hash(adminPass, 12);
          await pool.query(`INSERT INTO admins (username, password) VALUES ($1, $2)`, [adminUser, hash]);
          console.log(`[Startup] (PG) Admin user '${adminUser}' created successfully.`);
        } else {
          console.log(`[Startup] (PG) Admin '${adminUser}' already exists. Skipping creation.`);
        }
      } catch (err) {
        console.error('[Startup] (PG) Failed to seed admin user:', err);
      }
    } else {
      console.log('[Startup] (PG) INITIAL_ADMIN_USERNAME or PASSWORD not set. Skipping admin seeding.');
    }
    // ----------------------------------------------------------------
    // Schema Migration: v2 (Performance & Indexes)
    // ----------------------------------------------------------------
    console.log('[Startup] (PG) Running v2 performance migrations...');
    await client.query('BEGIN');
    try {
      // 1. Add display_date column
      await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='display_date') THEN
                    ALTER TABLE activities ADD COLUMN display_date TIMESTAMPTZ;
                    UPDATE activities SET display_date = COALESCE(activity_date, created_at);
                    ALTER TABLE activities ALTER COLUMN display_date SET NOT NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news' AND column_name='display_date') THEN
                    ALTER TABLE news ADD COLUMN display_date TIMESTAMPTZ;
                    UPDATE news SET display_date = created_at;
                    ALTER TABLE news ALTER COLUMN display_date SET NOT NULL;
                END IF;
            END$$;
        `);

      // 2. Add Indexes
      // GIN for tags
      await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_tags_gin ON activities USING GIN (tags);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_news_tags_gin ON news USING GIN (tags);`);

      // B-Tree for common filters
      await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_category ON activities (category);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_unit ON activities (unit);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_news_category ON news (category);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_news_unit ON news (unit);`);

      // Sort optimization
      await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_display_date ON activities (display_date DESC);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_news_display_date ON news (display_date DESC);`);

      await client.query('COMMIT');
      console.log('[Startup] (PG) v2 performance migrations completed.');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[Startup] (PG) v2 migration failed:', e);
      // Don't crash, old schema might still work for basic selects
    }
  };
}

module.exports = {
  query,
  setupDatabase,
  getClient,
  pool,
  useSqlite
};
