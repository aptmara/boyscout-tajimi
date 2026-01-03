const db = require('../database.js');
const { normalizeSlug, normalizeTags, normalizeUnits } = require('../utils/formatters.js');
const { sanitizePayload } = require('../utils/simple-sanitizer.js');

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
    // unit複数選択対応: カンマ区切りで検索（部分一致）
    const normalizedUnit = normalizeSlug(unit);
    params.push('%' + normalizedUnit + '%');
    where.push(`unit LIKE $${params.length}`);
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
  // 一覧では軽量データのみ返す：content→summary、image_urls→thumbnail
  const { rows } = await db.query(
    `SELECT 
        id,
        title,
        LEFT(regexp_replace(content, '<[^>]*>', '', 'g'), 150) AS summary,
        CASE 
          WHEN jsonb_array_length(image_urls) > 0 THEN jsonb_build_array(image_urls->0)
          ELSE '[]'::jsonb
        END AS thumbnail,
        category,
        unit,
        tags,
        activity_date,
        created_at,
        display_date
       FROM activities
       ${whereSql}
      ORDER BY display_date DESC
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
  const safeBody = sanitizePayload(req.body || {});
  const { title, content, category = null, unit = null, tags = [], activity_date = null, images = [] } = safeBody;
  if (!title || !content)
    return res.status(400).json({ error: 'Title and content are required' });

  const urls = Array.isArray(images) ? images : [];
  const uni = normalizeUnits(unit);
  const tgs = normalizeTags(tags);
  const { rows } = await db.query(
    `INSERT INTO activities(title, content, category, unit, tags, activity_date, image_urls, display_date)
     VALUES($1, $2, $3, $4, $5:: jsonb, $6, $7:: jsonb, COALESCE($6, CURRENT_TIMESTAMP))
     RETURNING id`,
    [title, content, category, uni, JSON.stringify(tgs), activity_date, JSON.stringify(urls)]
  );
  res.status(201).json({ id: rows[0].id, message: 'Created' });
});

const updateActivity = asyncHandler(async (req, res) => {
  const safeBody = sanitizePayload(req.body || {});
  const { title, content, category, unit, tags, activity_date, images } = safeBody;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const updates = {
    title: title,
    content: content,
    category: category,
    unit: normalizeUnits(unit),
    activity_date: activity_date,
    display_date: activity_date || undefined // Will be set to activity_date if provided. Note: complex logic if we want fallback to created_at requires DB fetch first or COALESCE in SQL. Let's handle it in SQL or assume if activity_date is set, display_date is it.
  };

  // Logic fix: display_date should update if activity_date is updated. 
  // But if activity_date is cleared (null), it should fallback to created_at.
  // Ideally we use a trigger, but for now let's set it in SQL logic or calculate it.
  // Simplest is: if activity_date is provided, use it. If not provided (undefined), don't touch.
  // If explicitly set to null, we need to know created_at. 
  // Since we don't fetch, let's just assume typically users update activity_date to a value.
  if (activity_date) {
    updates.display_date = activity_date;
  }

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
  const safeBody = sanitizePayload(req.body || {});
  const { title, content, images, category, unit, tags, activity_date } = safeBody;
  if (!title || !content) return res.status(400).json({ error: 'invalid_payload' });

  const rawImages = Array.isArray(images) ? images : [];

  // 画像をローカルにダウンロード
  const imgs = await processImages(rawImages);

  const cat = (category && String(category).trim()) || '未分類';
  const uni = normalizeUnits(unit);
  const tgs = normalizeTags(tags);
  const ad = activity_date ? new Date(activity_date) : null;

  await db.query(
    `INSERT INTO activities(title, content, image_urls, category, unit, tags, activity_date, display_date)
     VALUES($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::timestamp, COALESCE($7::timestamp, CURRENT_TIMESTAMP))`,
    [String(title), String(content), JSON.stringify(imgs), cat, uni || null, JSON.stringify(tgs), ad]
  );
  return res.status(201).json({ ok: true });
});

/**
 * フィルターオプションを取得（実際のデータから集計）
 */
const getActivityFilters = asyncHandler(async (req, res) => {
  // カテゴリ
  const catResult = await db.query(`
    SELECT DISTINCT category FROM activities 
    WHERE category IS NOT NULL AND category != '' 
    ORDER BY category
  `);

  // 隊（カンマ区切りを展開）
  const unitResult = await db.query(`
    SELECT DISTINCT TRIM(u) as unit 
    FROM activities, unnest(string_to_array(unit, ',')) AS u 
    WHERE unit IS NOT NULL AND unit != ''
    ORDER BY unit
  `);

  // タグ（JSONB配列を展開）
  const tagResult = await db.query(`
    SELECT DISTINCT tag 
    FROM activities, jsonb_array_elements_text(tags) AS tag 
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
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  activityWebhook,
  getActivityFilters,
};