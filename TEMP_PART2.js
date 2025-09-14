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

    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_activity_date ON activities (activity_date DESC NULLS LAST);`);

    await client.query('COMMIT');
    console.log('Tables are ready.');

    // --- オプション: 初回管理者自動作成 ---
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
  pool, // connect-pg-simple 用
};
