const db = require('../database.js');
const SITE_CONFIG = require('../utils/siteConfigKeys.js');
const fs = require('fs');
const path = require('path');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 全設定を取得し、グループごとに構造化して返す（管理画面用）
const getSettings = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT key, value FROM site_settings ORDER BY key ASC');

  // DBの値をマップ化
  const settingsMap = {};
  for (const r of rows) settingsMap[r.key] = r.value ?? '';

  // 定義ファイルに基づいてレスポンスを構築
  const structuredSettings = {};

  // キー定義にあるものを優先
  Object.keys(SITE_CONFIG.KEYS).forEach(key => {
    const config = SITE_CONFIG.KEYS[key];
    const group = config.group;
    if (!structuredSettings[group]) structuredSettings[group] = [];

    structuredSettings[group].push({
      key: key,
      value: settingsMap[key] || '', // DBにない場合は空文字
      ...config // label, type, etc.
    });
  });

  // DBにはあるが定義ファイルにないもの（カスタム設定など）は 'CUSTOM' グループへ
  const definedKeys = new Set(Object.keys(SITE_CONFIG.KEYS));
  for (const r of rows) {
    if (!definedKeys.has(r.key)) {
      if (!structuredSettings['CUSTOM']) structuredSettings['CUSTOM'] = [];
      structuredSettings['CUSTOM'].push({
        key: r.key,
        value: r.value,
        type: 'text',
        label: r.key,
        group: 'CUSTOM'
      });
    }
  }

  // フラットなオブジェクト（旧互換性またはEJS直接利用用）
  const flatSettings = { ...settingsMap };

  // リクエストがJSONを求めている場合（管理画面API）
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(200).json({
      groups: SITE_CONFIG.GROUPS,
      settings: structuredSettings,
      flat: flatSettings
    });
  }

  // 通常アクセスならJSON返却（現状の実装に合わせる）
  return res.status(200).json(flatSettings);
});

// 公開用の設定を取得（フロントエンド用）- 変更なしだがキー定義ファイルのリストを使用するように修正推奨
// 今回は既存実装を維持しつつ、定義ファイルにあるキーは全て公開しても良いか判断が必要。
// 一旦既存のリストを維持します。
const getPublicSettings = asyncHandler(async (req, res) => {
  // 定義ファイルにある画像URLなどは全て公開して問題ないはず
  const publicKeys = Object.keys(SITE_CONFIG.KEYS);

  if (publicKeys.length === 0) return res.json({});

  const placeholders = publicKeys.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await db.query(
    `SELECT key, value FROM site_settings WHERE key IN (${placeholders})`,
    publicKeys
  );

  const obj = {};
  for (const r of rows) obj[r.key] = r.value ?? '';

  // 画像がない場合のプレースホルダー処理などはフロントエンドで行う
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
        continue; // Skip invalid keys
      }
      const val = (value === null || value === undefined) ? '' : String(value);

      await client.query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, val]
      );
    }

    await client.query('COMMIT');

    // settings.routes.js で redirect 処理をするか、ここで JSON を返すか。
    // 管理画面からのPOST送信の場合、リダイレクトが便利かもしれないが、非同期fetchならJSON。
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(200).json({ ok: true, message: 'Settings updated successfully' });
    }
    // フォーム送信の場合はリロード
    return res.redirect('back');

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// 画像アップロードAPI
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // ファイルのURLパスを生成 (例: /uploads/filename.jpg)
  const fileUrl = `/uploads/${req.file.filename}`;
  const key = req.body.key; // 設定キー（例: 'index_hero_image_url'）

  // キーが指定されていれば、DBも更新する
  if (key && Object.keys(SITE_CONFIG.KEYS).includes(key)) {
    const client = await db.getClient();
    try {
      await client.query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, fileUrl]
      );
    } finally {
      client.release();
    }
  }

  return res.status(200).json({ ok: true, url: fileUrl, key: key });
});

module.exports = {
  getSettings,
  getPublicSettings,
  updateSettings,
  uploadImage,
};