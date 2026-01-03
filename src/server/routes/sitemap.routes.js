/**
 * サイトマップ動的生成ルート
 * XMLサイトマップを自動生成してSEOを強化
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// サイトURL（管理画面で設定されていない場合のデフォルト）
const DEFAULT_SITE_URL = 'https://www.tajimibs.org';

// 静的ページ一覧
const staticPages = [
    { url: '/', priority: 1.0, changefreq: 'weekly' },
    { url: '/about', priority: 0.8, changefreq: 'monthly' },
    { url: '/join', priority: 0.9, changefreq: 'monthly' },
    { url: '/contact', priority: 0.7, changefreq: 'monthly' },
    { url: '/activity-log', priority: 0.8, changefreq: 'weekly' },
    { url: '/news-list', priority: 0.8, changefreq: 'weekly' },

    { url: '/privacy', priority: 0.3, changefreq: 'yearly' },
    { url: '/sitemap', priority: 0.3, changefreq: 'monthly' },
    // 各隊ページ
    { url: '/unit-beaver', priority: 0.8, changefreq: 'monthly' },
    { url: '/unit-cub', priority: 0.8, changefreq: 'monthly' },
    { url: '/unit-boy', priority: 0.8, changefreq: 'monthly' },
    { url: '/unit-venture', priority: 0.8, changefreq: 'monthly' },
    { url: '/unit-rover', priority: 0.8, changefreq: 'monthly' },
];

/**
 * URL要素を生成
 */
function createUrlElement(loc, lastmod, changefreq, priority) {
    return `  <url>
    <loc>${loc}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * 日付をISO形式（YYYY-MM-DD）に変換
 */
function formatDateISO(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

/**
 * XMLサイトマップを生成
 */
router.get('/sitemap.xml', async (req, res) => {
    try {
        // サイトURLを取得（siteConfigから、なければデフォルト）
        const siteUrl = res.locals.siteConfig?.get('seo_site_url') || DEFAULT_SITE_URL;

        const urls = [];
        const now = formatDateISO(new Date());

        // 静的ページを追加
        for (const page of staticPages) {
            urls.push(createUrlElement(
                `${siteUrl}${page.url}`,
                now,
                page.changefreq,
                page.priority
            ));
        }

        // 動的ページ（ニュース）を追加
        try {
            const newsResult = await db.pool.query(
                'SELECT id, created_at FROM news WHERE is_published = true ORDER BY created_at DESC LIMIT 100'
            );
            for (const news of newsResult.rows) {
                const lastmod = formatDateISO(news.created_at);
                urls.push(createUrlElement(
                    `${siteUrl}/news/${news.id}`,
                    lastmod,
                    'monthly',
                    0.6
                ));
            }
        } catch (e) {
            // newsテーブルが無い場合はスキップ
            console.log('News table not available for sitemap:', e.message);
        }

        // 動的ページ（活動記録）を追加
        try {
            const activityResult = await db.pool.query(
                'SELECT id, activity_date, created_at FROM activities ORDER BY activity_date DESC, created_at DESC LIMIT 100'
            );
            for (const activity of activityResult.rows) {
                const lastmod = formatDateISO(activity.activity_date || activity.created_at);
                urls.push(createUrlElement(
                    `${siteUrl}/activity/${activity.id}`,
                    lastmod,
                    'monthly',
                    0.6
                ));
            }
        } catch (e) {
            // activitiesテーブルが無い場合はスキップ
            console.log('Activities table not available for sitemap:', e.message);
        }

        // XMLを生成
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
                            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls.join('\n')}
</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
        res.send(xml);

    } catch (err) {
        console.error('Error generating sitemap:', err);
        res.status(500).send('Error generating sitemap');
    }
});

module.exports = router;
