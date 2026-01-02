const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

// 保存先ディレクトリ
const UPLOAD_DIR = path.join(__dirname, '../../../public/uploads/webhook');

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Google Drive URLをダウンロード可能なURLに変換する
 */
function getDownloadUrl(url) {
    if (!url || typeof url !== 'string') return url;

    // Google DriveのファイルIDを抽出
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
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
        // ダウンロード確認画面をスキップするURL形式
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    return url;
}

/**
 * URLから画像をダウンロードし、ローカルに保存してパスを返す
 * 失敗した場合は元のURLを返す
 */
async function downloadImage(url) {
    if (!url || !url.startsWith('http')) return url;

    try {
        const downloadUrl = getDownloadUrl(url);

        // 拡張子の推定（簡易的）
        // Driveの場合は Content-Disposition ヘッダを見るのが確実だが、ここでは一旦 .jpg とする
        // 必要ならmime-typesライブラリなどで判定
        const ext = '.jpg';
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
                    // 失敗時は元のURLを返す
                    console.warn(`[ImageDownload] Failed to download: ${response.statusCode} - ${url}`);
                    response.resume();
                    resolve(url);
                    return;
                }

                const fileStream = fs.createWriteStream(filepath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`[ImageDownload] Saved: ${relativePath}`);
                    resolve(relativePath);
                });

                fileStream.on('error', (err) => {
                    fs.unlink(filepath, () => { }); // エラー時は削除
                    console.error('[ImageDownload] File write error:', err);
                    resolve(url);
                });
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
 * 画像URLの配列を受け取り、全てローカル化して返す
 */
async function processImages(imageUrls) {
    if (!Array.isArray(imageUrls)) return [];

    // 並列処理でダウンロード
    const promises = imageUrls.map(url => downloadImage(url));
    return Promise.all(promises);
}

module.exports = {
    downloadImage,
    processImages
};
