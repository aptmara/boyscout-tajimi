// src/server/migrations/convert-drive-urls.js
const db = require('../database');

const convertGoogleDriveUrl = (url) => {
  if (typeof url !== 'string') {
    return url;
  }

  // Handle the format: https://drive.usercontent.google.com/uc?export=view&id=FILE_ID
  if (url.includes('drive.usercontent.google.com/uc')) {
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    }
  }

  // Handle the format: https://drive.google.com/file/d/FILE_ID/view
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    }
  }

  return url;
};

const runMigration = async () => {
  console.log('Checking if URL conversion migration is needed...');

  const migrationFlag = await db.query("SELECT value FROM settings WHERE key = 'migration_drive_url_converted_v1'");
  if (migrationFlag.rows.length > 0 && migrationFlag.rows[0].value === 'true') {
    console.log('URL conversion migration has already been performed. Skipping.');
    return;
  }

  console.log('Starting URL conversion migration...');

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Convert 'activities' table
    console.log("Processing 'activities' table...");
    const activities = await client.query("SELECT id, image_urls FROM activities WHERE image_urls IS NOT NULL AND image_urls::text <> '[]'");
    let activitiesUpdated = 0;
    for (const row of activities.rows) {
      let urls = row.image_urls;
      if (typeof urls === 'string') {
        try {
          urls = JSON.parse(urls);
        } catch {
          console.warn(`  - Skipping activity ${row.id} due to invalid JSON in image_urls.`);
          continue;
        }
      }

      if (Array.isArray(urls)) {
        const newUrls = urls.map(convertGoogleDriveUrl);
        if (JSON.stringify(urls) !== JSON.stringify(newUrls)) {
          await client.query('UPDATE activities SET image_urls = $1 WHERE id = $2', [JSON.stringify(newUrls), row.id]);
          activitiesUpdated++;
        }
      }
    }
    console.log(`  - Updated ${activitiesUpdated} records in 'activities'.`);

    // 2. Convert 'news' table
    console.log("Processing 'news' table...");
    const news = await client.query("SELECT id, image_urls FROM news WHERE image_urls IS NOT NULL AND image_urls::text <> '[]'");
    let newsUpdated = 0;
    for (const row of news.rows) {
      let urls = row.image_urls;
      if (typeof urls === 'string') {
        try {
          urls = JSON.parse(urls);
        } catch {
          console.warn(`  - Skipping news ${row.id} due to invalid JSON in image_urls.`);
          continue;
        }
      }

      if (Array.isArray(urls)) {
        const newUrls = urls.map(convertGoogleDriveUrl);
        if (JSON.stringify(urls) !== JSON.stringify(newUrls)) {
          await client.query('UPDATE news SET image_urls = $1 WHERE id = $2', [JSON.stringify(newUrls), row.id]);
          newsUpdated++;
        }
      }
    }
    console.log(`  - Updated ${newsUpdated} records in 'news'.`);

    // 3. Convert 'settings' table
    console.log("Processing 'settings' table...");
    const settings = await client.query("SELECT key, value FROM settings WHERE key LIKE '%_url' AND (value LIKE '%drive.google.com/file/d/%' OR value LIKE '%drive.usercontent.google.com/uc%')");
    let settingsUpdated = 0;
    for (const row of settings.rows) {
      const newValue = convertGoogleDriveUrl(row.value);
      if (newValue !== row.value) {
        await client.query('UPDATE settings SET value = $1 WHERE key = $2', [newValue, row.key]);
        settingsUpdated++;
      }
    }
    console.log(`  - Updated ${settingsUpdated} records in 'settings'.`);

    // 4. Set migration flag
    console.log('Setting migration completion flag...');
    await client.query(
      "INSERT INTO settings (key, value) VALUES ('migration_drive_url_converted_v1', 'true')"
    );

    await client.query('COMMIT');
    console.log('URL conversion migration completed successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during URL conversion migration. Rolled back changes.', err);
    throw err; // re-throw error to be caught by the caller in server.js
  } finally {
    client.release();
  }
};

module.exports = { runMigration };
