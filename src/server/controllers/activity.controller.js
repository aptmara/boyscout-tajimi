const db = require('../database.js');
const { normalizeSlug, normalizeTags } = require('../utils/formatters.js');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const getAllActivities = asyncHandler(async (req, res) => {
  const { category, unit, tags, tags_any, limit, offset } = req.query || {};
  const lim = Math.min(parseInt(limit || '20', 10), 100);
  const off = Math.max(parseInt(offset || '0', 10), 0);

  const where = [];
  const params = [];
  if (category && String(category).trim()) {
    params.push(String(category).trim());
    where.push(`category = $${params.length}`);
  }
  if (unit && String(unit).trim()) {
    params.push(normalizeSlug(unit));
    where.push(`unit = $${params.length}`);
  }
  if (tags && String(tags).trim()) {
    const t = normalizeTags(tags);
    if (t.length) {
      params.push(JSON.stringify(t));
      where.push(`tags @> $${params.length}::jsonb`);
    }
  }
  if (!tags && tags_any && String(tags_any).trim()) {
    const anyList = normalizeTags(tags_any);
    if (anyList.length) {
      params.push(anyList);
      where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) z WHERE z.value = ANY($${params.length}))`);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(lim, off);
  const { rows } = await db.query(
    `SELECT id, title, content, image_urls, category, unit, tags, activity_date, created_at
       FROM activities
       ${whereSql}
      ORDER BY COALESCE(activity_date, created_at) DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return res.json(rows);
});

const getActivityById = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, title, content, category, unit, tags, activity_date, image_urls, created_at
     FROM activities
     WHERE id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
  res.json(rows[0]);
});

const createActivity = asyncHandler(async (req, res) => {
  const { title, content, category = null, unit = null, tags = [], activity_date = null, images = [] } = req.body || {};
  if (!title || !content)
    return res.status(400).json({ error: 'Title and content are required' });

  const urls = Array.isArray(images) ? images : [];
  const uni = unit ? normalizeSlug(unit) : null;
  const tgs = normalizeTags(tags);
  const { rows } = await db.query(
    `INSERT INTO activities (title, content, category, unit, tags, activity_date, image_urls)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
     RETURNING id`,
    [title, content, category, uni, JSON.stringify(tgs), activity_date, JSON.stringify(urls)]
  );
  res.status(201).json({ id: rows[0].id, message: 'Created' });
});

const updateActivity = asyncHandler(async (req, res) => {
  const { title, content, category, unit, tags, activity_date, images } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const updates = {
    title: title,
    content: content,
    category: category,
    unit: unit ? normalizeSlug(unit) : null,
    activity_date: activity_date,
  };

  if (images !== undefined) {
    updates.image_urls = JSON.stringify(Array.isArray(images) ? images : []);
  }
  if (tags !== undefined) {
    updates.tags = JSON.stringify(normalizeTags(tags));
  }

  const setClauses = [];
  const params = [];
  let i = 1;
  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = $${i++}`);
    params.push(value);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  params.push(req.params.id);
  const sql = `UPDATE activities SET ${setClauses.join(', ')} WHERE id = $${i}`;

  const { rowCount } = await db.query(sql, params);

  if (rowCount === 0) {
    return res.status(404).json({ error: 'Activity not found' });
  }
  res.json({ id: req.params.id, message: 'Updated' });
});

const deleteActivity = asyncHandler(async (req, res) => {
  const { rowCount } = await db.query(
    `DELETE FROM activities WHERE id = $1`,
    [req.params.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
  res.status(204).send();
});

const { processImages } = require('../utils/imageDownloader');

const activityWebhook = asyncHandler(async (req, res) => {
  const { title, content, images, category, unit, tags, activity_date } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

  const rawImages = Array.isArray(images) ? images : [];

  // 画像をローカルにダウンロード
  const imgs = await processImages(rawImages);

  const cat = (category && String(category).trim()) || '未分類';
  const uni = normalizeSlug(unit);
  const tgs = normalizeTags(tags);
  const ad = activity_date ? new Date(activity_date) : null;

  await db.query(
    `INSERT INTO activities (title, content, image_urls, category, unit, tags, activity_date)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7)`,
    [String(title), String(content), JSON.stringify(imgs), cat, uni || null, JSON.stringify(tgs), ad]
  );
  return res.status(201).json({ ok: true });
});

module.exports = {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  activityWebhook,
};