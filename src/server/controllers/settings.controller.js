const db = require('../database.js');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const getSettings = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT key, value FROM site_settings ORDER BY key ASC');
  if (req.path.endsWith('/all')) {
    return res.status(200).json(rows);
  }
  const obj = {};
  for (const r of rows) obj[r.key] = r.value ?? '';
  return res.status(200).json(obj);
});

const getPublicSettings = asyncHandler(async (req, res) => {
  const publicKeys = [
    'contact_address', 'contact_phone', 'contact_secondary_phone', 'contact_email', 'contact_person_name', 'contact_map_embed_html',
    'site_favicon_url',
    'leader_beaver', 'leader_cub', 'leader_boy', 'leader_venture', 'leader_rover',
    'group_crest_url',
    'unit_beaver_logo_url','unit_cub_logo_url','unit_boy_logo_url','unit_venture_logo_url','unit_rover_logo_url',
    'unit_beaver_leader_photo_url','unit_beaver_leader_message',
    'unit_cub_leader_photo_url','unit_cub_leader_message',
    'unit_boy_leader_photo_url','unit_boy_leader_message',
    'unit_venture_leader_photo_url','unit_venture_leader_message',
    'unit_rover_leader_photo_url','unit_rover_leader_message',
    'unit_beaver_gallery_img_1_url','unit_beaver_gallery_img_2_url','unit_beaver_gallery_img_3_url','unit_beaver_gallery_img_4_url',
    'unit_cub_gallery_img_1_url','unit_cub_gallery_img_2_url','unit_cub_gallery_img_3_url','unit_cub_gallery_img_4_url',
    'unit_boy_gallery_img_1_url','unit_boy_gallery_img_2_url','unit_boy_gallery_img_3_url','unit_boy_gallery_img_4_url',
    'unit_venture_gallery_img_1_url','unit_venture_gallery_img_2_url','unit_venture_gallery_img_3_url','unit_venture_gallery_img_4_url',
    'unit_rover_gallery_img_1_url','unit_rover_gallery_img_2_url','unit_rover_gallery_img_3_url','unit_rover_gallery_img_4_url',
    'privacy_contact_person', 'privacy_contact_phone', 'privacy_contact_email', 'privacy_effective_date', 'privacy_last_updated_date',
    'index_hero_image_url', 'index_highlight_img_1_url', 'index_highlight_img_2_url', 'index_highlight_img_3_url', 'index_testimonial_img_1_url', 'index_testimonial_img_2_url',
    'about_mission_image_url', 'about_safety_image_url',
  ];

  const placeholders = publicKeys.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await db.query(
    `SELECT key, value FROM site_settings WHERE key IN (${placeholders})`,
    publicKeys
  );

  const obj = {};
  for (const r of rows) obj[r.key] = r.value ?? '';
  return res.status(200).json(obj);
});

const updateSettings = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    for (const [key, value] of Object.entries(body)) {
      if (typeof key !== 'string' || !key.length) {
        return res.status(400).json({ error: 'invalid_key' });
      }
      const val = (value === null || value === undefined) ? '' : String(value);
      
      await client.query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, val]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Settings updated successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e; // Re-throw error to be caught by asyncHandler
  } finally {
    client.release();
  }
});

module.exports = {
    getSettings,
    getPublicSettings,
    updateSettings,
};