const path = require('path');
const { loadEnv } = require('../server/config/env');

// 環境変数をロード (database.jsが初期化される前に必須)
loadEnv();

const db = require('../server/database');
const { processImages } = require('../server/utils/imageDownloader');

async function migrateTable(tableName) {
    console.log(`[Migration] Starting migration for table: ${tableName}`);

    // JSON配列にドライブURLが含まれているかもしれないレコードを取得
    // 簡易的に全レコード取得してJS側でフィルタリングする（件数が少ないため安全かつ確実）
    const { rows } = await db.query(`SELECT id, title, image_urls FROM ${tableName} ORDER BY id DESC`);

    let updatedCount = 0;

    for (const row of rows) {
        let urls = row.image_urls;

        // 文字列の場合はJSONパース
        if (typeof urls === 'string') {
            try {
                urls = JSON.parse(urls);
            } catch (e) {
                console.warn(`[Migration] Invalid JSON in ${tableName} ID ${row.id}:`, urls);
                continue;
            }
        }

        if (!Array.isArray(urls) || urls.length === 0) continue;

        // Google Drive URLが含まれているかチェック
        const hasDriveUrl = urls.some(url => url && url.includes('drive.google.com'));

        if (hasDriveUrl) {
            console.log(`[Migration] Processing ${tableName} ID ${row.id}: ${row.title}`);
            try {
                // 画像をローカル化 (WebP変換含む)
                const newUrls = await processImages(urls);

                // URLが変わった場合のみ更新
                if (JSON.stringify(newUrls) !== JSON.stringify(urls)) {
                    await db.query(`UPDATE ${tableName} SET image_urls = $1 WHERE id = $2`, [JSON.stringify(newUrls), row.id]);
                    console.log(`[Migration] Updated ${tableName} ID ${row.id}`);
                    updatedCount++;
                }
            } catch (err) {
                console.error(`[Migration] Failed to process ${tableName} ID ${row.id}:`, err);
            }
        }
    }

    console.log(`[Migration] Finished ${tableName}. Updated records: ${updatedCount}`);
}

async function main() {
    try {
        console.log('[Migration] Migration started.');

        await migrateTable('news');
        await migrateTable('activities');

        console.log('[Migration] All migrations completed successfully.');
    } catch (error) {
        console.error('[Migration] Fatal error:', error);
        process.exit(1);
    } finally {
        // DB接続を切断しないとプロセスが終わらない場合があるが、database.jsはプールを使用している
        // 明示的に終了する方法がないため、強制終了させるか、pool.end()が必要だがdatabase.jsはそれを公開していない
        // 今回はプロセス終了で強制切断
        process.exit(0);
    }
}

main();
