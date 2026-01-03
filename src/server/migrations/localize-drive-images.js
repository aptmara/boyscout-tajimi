/**
 * localize-drive-images.js
 * 
 * サーバー起動時に実行され、Google Drive URLをローカル画像に変換する。
 * - 対象: settings, news, activities テーブルの画像URL
 * - 変換済みURLはスキップ（キャッシュ）
 * - バックグラウンドで非同期実行（サーバー起動をブロックしない）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const sharp = require('sharp');
const db = require('../database');

// 保存先ディレクトリ
const UPLOAD_DIR = path.join(__dirname, '../../../public/uploads/settings');

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * URLがGoogle DriveのURLかどうかを判定
 */
function isGoogleDriveUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('drive.google.com') || url.includes('drive.usercontent.google.com');
}

/**
 * Google Drive URLからファイルIDを抽出し、サムネイルURLを生成
 * サムネイルURLはリダイレクトなしで直接画像を返す
 */
function getThumbnailUrl(url) {
    // すでにサムネイル形式ならそのまま返す
    if (url.includes('/thumbnail?')) {
        return url;
    }

    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /open\?id=([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            // サムネイル形式（リダイレクトなし、高解像度）
            return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
        }
    }
    return url;
}

/**
 * URLから画像をダウンロードしてWebPに変換・保存
 * @returns {Promise<string|null>} 成功時はローカルパス、失敗時はnull
 */
async function downloadAndConvert(url, maxRedirects = 3) {
    if (maxRedirects <= 0) {
        console.warn('[LocalizeDrive] Too many redirects:', url);
        return null;
    }

    const downloadUrl = getThumbnailUrl(url);
    const filename = crypto.randomUUID() + '.webp';
    const filepath = path.join(UPLOAD_DIR, filename);
    const relativePath = `/uploads/settings/${filename}`;

    return new Promise((resolve) => {
        https.get(downloadUrl, (response) => {
            // リダイレクト対応
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                downloadAndConvert(response.headers.location, maxRedirects - 1)
                    .then(resolve);
                return;
            }

            if (response.statusCode !== 200) {
                console.warn(`[LocalizeDrive] HTTP ${response.statusCode}: ${url}`);
                response.resume();
                resolve(null);
                return;
            }

            // Sharpでリサイズ・WebP変換
            const transform = sharp()
                .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 });

            const fileStream = fs.createWriteStream(filepath);

            response.pipe(transform).pipe(fileStream);

            fileStream.on('finish', () => {
                console.log(`[LocalizeDrive] Saved: ${relativePath}`);
                resolve(relativePath);
            });

            const handleError = (err) => {
                console.error('[LocalizeDrive] Error:', err.message);
                fs.unlink(filepath, () => { });
                resolve(null);
            };

            response.on('error', handleError);
            transform.on('error', handleError);
            fileStream.on('error', handleError);

        }).on('error', (err) => {
            console.error('[LocalizeDrive] Request error:', err.message);
            resolve(null);
        });
    });
}

/**
 * settingsテーブルのGoogle Drive URLをローカル化
 */
async function localizeSettings() {
    console.log('[LocalizeDrive] Checking settings...');

    const { rows } = await db.query(
        "SELECT key, value FROM settings WHERE key LIKE '%_url' AND value LIKE '%drive.google.com%'"
    );

    if (rows.length === 0) {
        console.log('[LocalizeDrive] No Google Drive URLs found in settings.');
        return;
    }

    console.log(`[LocalizeDrive] Found ${rows.length} Google Drive URLs in settings.`);

    for (const row of rows) {
        try {
            const localPath = await downloadAndConvert(row.value);
            if (localPath) {
                await db.query('UPDATE settings SET value = $1 WHERE key = $2', [localPath, row.key]);
                console.log(`[LocalizeDrive] Updated: ${row.key}`);
            } else {
                console.warn(`[LocalizeDrive] Failed to convert: ${row.key}`);
            }
        } catch (err) {
            console.error(`[LocalizeDrive] Error processing ${row.key}:`, err.message);
        }
    }
}

/**
 * news/activitiesテーブルのGoogle Drive URLをローカル化
 */
async function localizeContentImages(tableName) {
    console.log(`[LocalizeDrive] Checking ${tableName}...`);

    const { rows } = await db.query(
        `SELECT id, image_urls FROM ${tableName} WHERE image_urls::text LIKE '%drive.google.com%'`
    );

    if (rows.length === 0) {
        console.log(`[LocalizeDrive] No Google Drive URLs found in ${tableName}.`);
        return;
    }

    console.log(`[LocalizeDrive] Found ${rows.length} records with Google Drive URLs in ${tableName}.`);

    for (const row of rows) {
        try {
            let urls = row.image_urls;
            if (typeof urls === 'string') {
                urls = JSON.parse(urls);
            }
            if (!Array.isArray(urls)) continue;

            let changed = false;
            const newUrls = [];
            for (const url of urls) {
                if (isGoogleDriveUrl(url)) {
                    const localPath = await downloadAndConvert(url);
                    if (localPath) {
                        newUrls.push(localPath);
                        changed = true;
                    } else {
                        newUrls.push(url); // 失敗時は元のURLを保持
                    }
                } else {
                    newUrls.push(url);
                }
            }

            if (changed) {
                await db.query(
                    `UPDATE ${tableName} SET image_urls = $1 WHERE id = $2`,
                    [JSON.stringify(newUrls), row.id]
                );
                console.log(`[LocalizeDrive] Updated ${tableName} id=${row.id}`);
            }
        } catch (err) {
            console.error(`[LocalizeDrive] Error processing ${tableName} id=${row.id}:`, err.message);
        }
    }
}

/**
 * メイン実行関数（非同期・バックグラウンド実行用）
 */
async function runMigration() {
    console.log('[LocalizeDrive] Starting background image localization...');

    try {
        // 1. Settings
        await localizeSettings();

        // 2. News
        await localizeContentImages('news');

        // 3. Activities
        await localizeContentImages('activities');

        console.log('[LocalizeDrive] Image localization completed.');
    } catch (err) {
        console.error('[LocalizeDrive] Migration error:', err);
    }
}

module.exports = { runMigration };
