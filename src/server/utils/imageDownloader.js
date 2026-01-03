const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const sharp = require('sharp'); // Image processing

// 保存先ディレクトリ
const UPLOAD_DIR = path.join(__dirname, '../../../public/uploads/webhook');

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Google Drive URLをダウンロード可能なサムネイルURLに変換する
 * サムネイル形式はリダイレクトなしで直接画像を返す
 */
function getDownloadUrl(url) {
    if (!url || typeof url !== 'string') return url;

    // すでにサムネイル形式ならそのまま返す
    if (url.includes('/thumbnail?')) {
        return url;
    }

    // Google DriveのファイルIDを抽出
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /open\?id=([a-zA-Z0-9_-]+)/
    ];

    let fileId = null;
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            fileId = match[1];
            break;
        }
    }

    if (fileId) {
        // サムネイル形式（リダイレクトなし、高解像度）
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    }

    return url;
}

/**
 * URLから画像をダウンロードし、ローカルに保存してパスを返す
 * 失敗した場合は元のURLを返す
 * 自動的にWebPに変換・リサイズする
 */
async function downloadImage(url) {
    if (!url || !url.startsWith('http')) return url;

    try {
        const downloadUrl = getDownloadUrl(url);

        // WebPに変換して保存
        const ext = '.webp';
        const filename = crypto.randomUUID() + ext;
        const filepath = path.join(UPLOAD_DIR, filename);
        const relativePath = `/uploads/webhook/${filename}`;

        return new Promise((resolve, reject) => {
            https.get(downloadUrl, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    // リダイレクト対応
                    downloadImage(response.headers.location).then(resolve).catch(() => resolve(url));
                    return;
                }

                if (response.statusCode !== 200) {
                    console.warn(`[ImageDownload] Failed to download: ${response.statusCode} - ${url}`);
                    response.resume();
                    resolve(url);
                    return;
                }

                // Sharpストリームを作成 (リサイズ & WebP変換)
                const transform = sharp()
                    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }) // 長辺1280pxに収める
                    .webp({ quality: 80 });

                const fileStream = fs.createWriteStream(filepath);

                // パイプライン接続: response -> transform -> fileStream
                response.pipe(transform).pipe(fileStream);

                fileStream.on('finish', () => {
                    console.log(`[ImageDownload] Saved (WebP): ${relativePath}`);
                    resolve(relativePath);
                });

                // エラーハンドリング
                const handleError = (err) => {
                    console.error('[ImageDownload] Stream error:', err);
                    // 途中ファイルを削除（ファイルオープン前ならエラーになることもあるが無視）
                    fs.unlink(filepath, () => { });
                    resolve(url); // 元のURLを返す（フォールバック）
                };

                response.on('error', handleError);
                transform.on('error', handleError);
                fileStream.on('error', handleError);

            }).on('error', (err) => {
                console.error('[ImageDownload] Request error:', err);
                resolve(url);
            });
        });

    } catch (error) {
        console.error('[ImageDownload] Exception:', error);
        return url; // 失敗時は元のURLを返す
    }
}

/**
 * Base64エンコードされた画像を保存
 * GAS Webhookから直接画像データを受信する場合に使用
 * @param {Object} img - { data: string, contentType: string, filename?: string }
 * @returns {Promise<string>} - 保存先パス（/uploads/webhook/xxx.webp）
 */
async function saveBase64Image(img) {
    if (!img || !img.data) {
        console.warn('[ImageDownload] Invalid base64 image object');
        return null;
    }

    try {
        const buffer = Buffer.from(img.data, 'base64');
        const filename = crypto.randomUUID() + '.webp';
        const filepath = path.join(UPLOAD_DIR, filename);
        const relativePath = `/uploads/webhook/${filename}`;

        // Sharp で WebP変換・リサイズ
        await sharp(buffer)
            .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filepath);

        console.log(`[ImageDownload] Saved base64 (WebP): ${relativePath}`);
        return relativePath;
    } catch (error) {
        console.error('[ImageDownload] Base64 save failed:', error);
        return null;
    }
}

/**
 * 画像の配列を受け取り、全てローカル化して返す
 * URL形式（従来）とBase64形式（新）の両方に対応
 * @param {Array} images - URL文字列または{data, contentType}オブジェクトの配列
 * @returns {Promise<string[]>} - 保存先パスの配列
 */
async function processImages(images) {
    if (!Array.isArray(images)) return [];

    const results = [];
    for (const img of images) {
        try {
            if (typeof img === 'string') {
                // 従来のURL形式（後方互換）
                const result = await downloadImage(img);
                if (result) results.push(result);
            } else if (img && typeof img === 'object' && img.data) {
                // 新しいBase64形式
                const result = await saveBase64Image(img);
                if (result) results.push(result);
            }
        } catch (err) {
            console.error('[ImageDownload] processImages error:', err);
        }
    }
    return results;
}

module.exports = {
    downloadImage,
    saveBase64Image,
    processImages
};
