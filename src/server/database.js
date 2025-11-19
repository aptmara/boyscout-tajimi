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

    // Initial Admin
    const adminUser = process.env.INITIAL_ADMIN_USERNAME;
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD;
    if (adminUser && adminPass) {
      try {
        const { rows } = await query(`SELECT 1 FROM admins WHERE username = $1`, [adminUser]);
        if (rows.length === 0) {
          const hash = await bcrypt.hash(adminPass, 12);
          await query(`INSERT INTO admins (username, password) VALUES ($1, $2)`, [adminUser, hash]);
          console.log(`Admin user '${adminUser}' created.`);
        }
      } catch (e) { console.error(e); }
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
          ('contact_address', '〒XXX-XXXX 岐阜県多治見市XX町X-X-X', 'フッターや連絡先ページに表示する住所'),
          ('contact_phone', '0572-XX-XXXX', 'フッターや連絡先ページに表示する代表電話番号'),
          ('contact_email', 'info@bs-tajimi1.example.jp', 'フッターや連絡先ページに表示するメールアドレス')
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
    if (adminUser && adminPass) {
      const { rows } = await pool.query(`SELECT 1 FROM admins WHERE username = $1`, [adminUser]);
      if (rows.length === 0) {
        const hash = await bcrypt.hash(adminPass, 12);
        await pool.query(`INSERT INTO admins (username, password) VALUES ($1, $2)`, [adminUser, hash]);
        console.log(`Admin user '${adminUser}' created.`);
      }
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
