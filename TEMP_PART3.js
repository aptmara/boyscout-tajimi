  } catch (e) {
    console.error('GET /api/news error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, image_urls, created_at
       FROM news
       WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'News not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/news/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/api/news', authMiddleware);

app.post('/api/news', async (req, res) => {
  try {
    const { title, content, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    const urls = Array.isArray(images) ? images : [];
    const { rows } = await db.query(
      `INSERT INTO news (title, content, image_urls)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [title, content, JSON.stringify(urls)]
    );
    res.status(201).json({ id: rows[0].id, message: 'Created' });
  } catch (err) {
    console.error('POST /api/news error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/news/:id', async (req, res) => {
  try {
    const { title, content, images = null } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    let clause = '';
    const params = [title, content, req.params.id];
    if (Array.isArray(images)) {
      clause = ', image_urls = $3';
      params.splice(2, 0, JSON.stringify(images));
    }

    const { rowCount } = await db.query(
      `UPDATE news
       SET title = $1,
           content = $2
           ${clause}
       WHERE id = $${clause ? 4 : 3}`,
      params
    );

    if (rowCount === 0) return res.status(404).json({ error: 'News not found' });
    res.json({ id: req.params.id, message: 'Updated' });
  } catch (err) {
    console.error('PUT /api/news/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM news WHERE id = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'News not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/news/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// News WebHook（GAS からの投稿）：title, content, images[], category? を受け取る
app.post('/api/news-webhook', async (req, res) => {
  try {
    const { title, content, images, category } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

    const imgs = Array.isArray(images) ? images : [];
    const cat  = (category && String(category).trim()) || '未分類';

    await db.query(
      `INSERT INTO news (title, content, image_urls, category)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [String(title), String(content), JSON.stringify(imgs), cat]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('news-webhook error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});


// ================================================================
// Activity API（DB版）
// ================================================================
app.get('/api/activities', async (req, res) => {
  try {
    const { category, limit, offset } = req.query || {};
    const lim = Math.min(parseInt(limit || '20', 10), 100);
    const off = Math.max(parseInt(offset || '0', 10), 0);

    if (category && String(category).trim()) {
      const { rows } = await db.query(
        `SELECT id, title, content, image_urls, category, activity_date, created_at
           FROM activities
          WHERE category = $1
          ORDER BY COALESCE(activity_date, created_at) DESC
          LIMIT $2 OFFSET $3`,
        [String(category).trim(), lim, off]
      );
      return res.json(rows);
    } else {
      const { rows } = await db.query(
        `SELECT id, title, content, image_urls, category, activity_date, created_at
           FROM activities
          ORDER BY COALESCE(activity_date, created_at) DESC
          LIMIT $1 OFFSET $2`,
        [lim, off]
      );
      return res.json(rows);
    }
  } catch (e) {
    console.error('GET /api/activities error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/activities/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, category, activity_date, image_urls, created_at
       FROM activities
       WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/activities/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/api/activities', authMiddleware);

app.post('/api/activities', async (req, res) => {
  try {
    const { title, content, category = null, activity_date = null, images = [] } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    const urls = Array.isArray(images) ? images : [];
    const { rows } = await db.query(
      `INSERT INTO activities (title, content, category, activity_date, image_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, content, category, activity_date, JSON.stringify(urls)]
    );
    res.status(201).json({ id: rows[0].id, message: 'Created' });
  } catch (err) {
    console.error('POST /api/activities error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/activities/:id', async (req, res) => {
  try {
    const { title, content, category = null, activity_date = null, images = null } = req.body || {};
    if (!title || !content)
      return res.status(400).json({ error: 'Title and content are required' });

    let imageClause = '';
    const params = [title, content, category, activity_date, req.params.id];
    if (Array.isArray(images)) {
      imageClause = ', image_urls = $5';
      params.splice(4, 0, JSON.stringify(images));
    }

    const { rowCount } = await db.query(
      `UPDATE activities
       SET title = $1,
           content = $2,
           category = $3,
           activity_date = $4
           ${imageClause}
       WHERE id = $${imageClause ? 6 : 5}`,
      params
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json({ id: req.params.id, message: 'Updated' });
  } catch (err) {
    console.error('PUT /api/activities/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM activities WHERE id = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/activities/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Activity WebHook：title, content, images[], category?, activity_date? を受け取る
app.post('/api/activity-webhook', async (req, res) => {
  try {
    const { title, content, images, category, activity_date } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

    const imgs = Array.isArray(images) ? images : [];
    const cat  = (category && String(category).trim()) || '未分類';
    const ad   = activity_date ? new Date(activity_date) : null;

    await db.query(
      `INSERT INTO activities (title, content, image_urls, category, activity_date)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [String(title), String(content), JSON.stringify(imgs), cat, ad]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('activity-webhook error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});


// ================================================================
// Settings API (修正版)
// ================================================================

// GET /api/settings - 設定を取得
// (admin/settings.html が実際に使用する /api/settings/all のエイリアスとしても機能)
app.get(['/api/settings', '/api/settings/all'], authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings');
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) {
    console.error(`GET ${req.path} error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings - 設定を保存
app.post('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { site_title, contact_email } = req.body;
    if (typeof site_title === 'undefined' || typeof contact_email === 'undefined') {
      return res.status(400).json({ error: 'site_title and contact_email are required.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('site_title', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [site_title]
      );
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('contact_email', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [contact_email]
      );
      await client.query('COMMIT');
      res.json({ message: 'Settings updated successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /api/settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------
// /json-api を mount（最後でOK）
// ------------------------------
const jsonApi = require('./server-json');      // Router
app.use('/json-api', jsonApi);

// /uploads をグローバルで公開（server-json.js の保存先を流用）
const UPLOAD_DIR = jsonApi.UPLOAD_DIR;
app.use('/uploads', express.static(UPLOAD_DIR, {
  etag: true,
  maxAge: '7d',
  immutable: true,
}));

// ------------------------------
// 起動（唯一の listen ）
// ------------------------------
function startServer(app) {
  const port = Number(process.env.PORT || 10000);
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`env.PORT=${process.env.PORT ?? 'undefined'}`);
  });
  return server;
}

startServer(app);
