const db = require('../database.js');
const News = require('../models/news.model');
const { normalizeSlug, normalizeTags, normalizeUnits } = require('../utils/formatters.js');
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
  const uni = normalizeUnits(unit);
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
    unit: normalizeUnits(unit),
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
  // 削除前に画像URLを取得
  const { rows } = await db.query(
    `SELECT image_urls FROM news WHERE id = $1`,
    [req.params.id]
  );

  const { rowCount } = await db.query(
    `DELETE FROM news WHERE id = $1`,
    [req.params.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'News not found' });

  // 関連画像を削除（バックグラウンド）
  if (rows.length > 0 && rows[0].image_urls) {
    const { deleteImages } = require('../utils/imageDownloader');
    const imageUrls = Array.isArray(rows[0].image_urls)
      ? rows[0].image_urls
      : [];
    deleteImages(imageUrls).catch(err =>
      console.error('[DeleteNews] Image cleanup failed:', err)
    );
  }

  res.status(204).send();
});

const { processImages } = require('../utils/imageDownloader');

const newsWebhook = asyncHandler(async (req, res) => {
  const safeBody = sanitizePayload(req.body || {});
  const { title, content, images, category, unit, tags } = safeBody;
  if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

  const rawImages = Array.isArray(images) ? images : [];

  // 画像をローカルに保存（Base64→ファイル）
  const imgs = await processImages(rawImages);

  // contentの画像プレースホルダーを実際の画像URLに置換
  // GAS側: <img data-image-index="N" ...> → <img src="/uploads/images/xxx.webp" ...>
  let processedContent = String(content);
  processedContent = processedContent.replace(
    /<img\s+data-image-index="(\d+)"([^>]*)>/gi,
    (match, indexStr, rest) => {
      const index = parseInt(indexStr, 10);
      if (index >= 0 && index < imgs.length) {
        return `<img src="${imgs[index]}"${rest}>`;
      }
      // インデックス範囲外の場合はプレースホルダーを削除
      return '';
    }
  );

  const cat = (category && String(category).trim()) || '未分類';
  const uni = normalizeUnits(unit);
  const tgs = normalizeTags(tags);

  await db.query(
    `INSERT INTO news (title, content, image_urls, category, unit, tags, display_date)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)`,
    [String(title), processedContent, JSON.stringify(imgs), cat, uni || null, JSON.stringify(tgs)]
  );
  return res.status(201).json({ ok: true });
});

/**
 * フィルターオプションを取得（実際のデータから集計）
 */
const getNewsFilters = asyncHandler(async (req, res) => {
  // カテゴリ
  const catResult = await db.query(`
    SELECT DISTINCT category FROM news 
    WHERE category IS NOT NULL AND category != '' 
    ORDER BY category
  `);

  // 隊（カンマ区切りを展開）
  const unitResult = await db.query(`
    SELECT DISTINCT TRIM(u) as unit 
    FROM news, unnest(string_to_array(unit, ',')) AS u 
    WHERE unit IS NOT NULL AND unit != ''
    ORDER BY unit
  `);

  // タグ（JSONB配列を展開）
  const tagResult = await db.query(`
    SELECT DISTINCT tag 
    FROM news, jsonb_array_elements_text(tags) AS tag 
    WHERE jsonb_array_length(tags) > 0
    ORDER BY tag
  `);

  return res.json({
    categories: catResult.rows.map(r => r.category),
    units: unitResult.rows.map(r => r.unit),
    tags: tagResult.rows.map(r => r.tag)
  });
});

module.exports = {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  newsWebhook,
  getNewsFilters,
};