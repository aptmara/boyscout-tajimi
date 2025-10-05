const db = require('../database.js');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const getSummary = asyncHandler(async (req, res) => {
  const [
    newsCountRes,
    newsRecentRes,
    newsRecent30Res,
    activitiesCountRes,
    activitiesRecentRes,
    activitiesRecent30Res,
    settingsRowsRes
  ] = await Promise.all([
    db.query("SELECT COUNT(*)::int AS count FROM news"),
    db.query(`SELECT id, title, category, unit, created_at
               FROM news
               ORDER BY created_at DESC
               LIMIT 5`),
    db.query("SELECT COUNT(*)::int AS count FROM news WHERE created_at >= now() - interval '30 days'"),
    db.query("SELECT COUNT(*)::int AS count FROM activities"),
    db.query(`SELECT id, title, category, unit, activity_date, created_at
               FROM activities
               ORDER BY COALESCE(activity_date, created_at) DESC
               LIMIT 5`),
    db.query("SELECT COUNT(*)::int AS count FROM activities WHERE COALESCE(activity_date, created_at) >= now() - interval '30 days'"),
    db.query('SELECT key, value FROM settings')
  ]);

  const toNumber = (row) => Number(row?.count || 0);
  const newsTotal = toNumber(newsCountRes.rows[0]);
  const newsRecent30 = toNumber(newsRecent30Res.rows[0]);
  const activitiesTotal = toNumber(activitiesCountRes.rows[0]);
  const activitiesRecent30 = toNumber(activitiesRecent30Res.rows[0]);

  const settingsMap = Object.create(null);
  for (const row of settingsRowsRes.rows) {
    settingsMap[row.key] = row.value || '';
  }

  const importantKeys = [
    { key: 'site_favicon_url', label: 'ファビコンURL' },
    { key: 'group_crest_url', label: '団章画像URL' },
    { key: 'contact_address', label: '代表住所' },
    { key: 'contact_phone', label: '代表電話番号' },
    { key: 'contact_email', label: '代表メールアドレス' },
    { key: 'index_hero_image_url', label: 'トップページヒーロー画像' },
    { key: 'about_mission_image_url', label: '団紹介：理念セクション画像' },
    { key: 'about_safety_image_url', label: '団紹介：安全セクション画像' }
  ];

  const isPresent = (value) => Boolean(String(value || '').trim());
  const missingKeys = importantKeys.filter(({ key }) => !isPresent(settingsMap[key]));

  res.json({
    news: {
      total: newsTotal,
      trendLabel: `直近30日: ${newsRecent30}件`,
      recent: newsRecentRes.rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        unit: row.unit,
        created_at: row.created_at,
      })),
    },
    activities: {
      total: activitiesTotal,
      trendLabel: `直近30日: ${activitiesRecent30}件`,
      recent: activitiesRecentRes.rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        unit: row.unit,
        activity_date: row.activity_date,
        created_at: row.created_at,
      })),
    },
    settings: {
      missingKeys,
      faviconConfigured: isPresent(settingsMap.site_favicon_url),
      heroConfigured: isPresent(settingsMap.index_hero_image_url),
    },
  });
});

module.exports = {
    getSummary,
};