const db = require('../database.js');
const News = require('../models/news.model');
const { normalizeSlug, normalizeTags } = require('../utils/formatters.js');
const { sanitizePayload } = require('../utils/simple-sanitizer.js');

// Utility to wrap async route handlers and catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const getAllNews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 9 } = req.query;

  const { items, total } = await News.findAll(req.query);

  const p = parseInt(page, 10) || 1;
  const lim = parseInt(limit, 10) || 9;

  return res.json({
    items,
    total,
    page: p,
    limit: lim,
    totalPages: total > 0 ? Math.ceil(total / lim) : 1,
  });
});

const getNewsById = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, title, content, image_urls, category, unit, tags, created_at
     FROM news
     WHERE id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'News not found' });
  return res.json(rows[0]);
});

const createNews = asyncHandler(async (req, res) => {
  const safeBody = sanitizePayload(req.body || {});
  const { title, content, images = [], category = null, unit = null, tags = [] } = safeBody;
  if (!title || !content)
    return res.status(400).json({ error: 'Title and content are required' });

  const urls = Array.isArray(images) ? images : [];
  const uni = unit ? normalizeSlug(unit) : null;
  const tgs = normalizeTags(tags);
  const { rows } = await db.query(
    `INSERT INTO news (title, content, image_urls, category, unit, tags, display_date)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)
     RETURNING id`,
    [title, content, JSON.stringify(urls), category, uni, JSON.stringify(tgs)]
  );
  res.status(201).json({ id: rows[0].id, message: 'Created' });
});

const updateNews = asyncHandler(async (req, res) => {
  const safeBody = sanitizePayload(req.body || {});
  const { title, content, images, category, unit, tags } = safeBody;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const updates = {
    title: title,
    content: content,
    category: category,
    unit: unit ? normalizeSlug(unit) : null,
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
  const sql = `UPDATE news SET ${setClauses.join(', ')} WHERE id = $${i}`;

  const { rowCount } = await db.query(sql, params);

  if (rowCount === 0) {
    return res.status(404).json({ error: 'News not found' });
  }
  res.json({ id: req.params.id, message: 'Updated' });
});

const deleteNews = asyncHandler(async (req, res) => {
  const { rowCount } = await db.query(
    `DELETE FROM news WHERE id = $1`,
    [req.params.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'News not found' });
  res.status(204).send();
});

const { processImages } = require('../utils/imageDownloader');

const newsWebhook = asyncHandler(async (req, res) => {
  const safeBody = sanitizePayload(req.body || {});
  const { title, content, images, category, unit, tags } = safeBody;
  if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

  const rawImages = Array.isArray(images) ? images : [];

  // 画像をローカルにダウンロード
  const imgs = await processImages(rawImages);

  const cat = (category && String(category).trim()) || '未分類';
  const uni = normalizeSlug(unit);
  const tgs = normalizeTags(tags);

  await db.query(
    `INSERT INTO news (title, content, image_urls, category, unit, tags, display_date)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)`,
    [String(title), String(content), JSON.stringify(imgs), cat, uni || null, JSON.stringify(tgs)]
  );
  return res.status(201).json({ ok: true });
});

module.exports = {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  newsWebhook,
};