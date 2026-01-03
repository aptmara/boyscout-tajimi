const express = require('express');
const router = express.Router();
const db = require('../database');
const helpers = require('../utils/template-helpers');
const {
  formatDateJP,
  pickFirstImage,
  buildSummary,
  formatUnitLabel
} = helpers;

// SEOヘルパーをインポート
const { generateSEO, generateFullJsonLD, pageSEOConfig } = require('../utils/seo-helpers');

/**
 * SEO情報を生成するヘルパー関数
 * siteConfigからサイト設定を取得してSEO情報を生成
 */
function buildSEOData(path, siteConfig) {
  // siteConfigからDB設定を取得
  const siteSettings = {};
  if (siteConfig && typeof siteConfig.get === 'function') {
    siteSettings.seo_site_url = siteConfig.get('seo_site_url') || 'https://www.tajimibs.org';
    siteSettings.seo_site_name = siteConfig.get('seo_site_name') || 'ボーイスカウト多治見第一団';
    siteSettings.seo_default_description = siteConfig.get('seo_default_description');
    siteSettings.seo_default_keywords = siteConfig.get('seo_default_keywords');
    siteSettings.seo_og_image_url = siteConfig.get('seo_og_image_url');
    siteSettings.seo_twitter_card_type = siteConfig.get('seo_twitter_card_type');
    siteSettings.seo_organization_name = siteConfig.get('seo_organization_name');
    siteSettings.seo_organization_founding_date = siteConfig.get('seo_organization_founding_date');
    siteSettings.group_crest_url = siteConfig.get('group_crest_url');
  } else {
    // siteConfigが無い場合のデフォルト
    siteSettings.seo_site_url = 'https://www.tajimibs.org';
    siteSettings.seo_site_name = 'ボーイスカウト多治見第一団';
  }

  const seo = generateSEO(path, siteSettings);
  seo.jsonLD = generateFullJsonLD(path, siteSettings);

  return seo;
}


// Card Data Shaper
// DBから取得したデータをhighlightCardパーシャルが期待する形式に変換
const shapeCardData = (item, type) => {
  if (type === 'activity') {
    const badges = [];
    if (item.unit) badges.push({ text: formatUnitLabel(item.unit), className: 'bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200' });

    return {
      imageUrl: pickFirstImage(item.image_urls, item.category || item.title || '活動'),
      altText: item.title,
      placeholderText: item.category || '活動',
      dateText: item.activity_date ? formatDateJP(item.activity_date) : (item.created_at ? formatDateJP(item.created_at) : ''),
      badges: badges,
      title: item.title,
      detailUrl: `/activity/${item.id}`,
      summary: buildSummary(item.content, 120),
      ctaText: '詳細を見る'
    };
  }
  if (type === 'news') {
    const badges = [];
    if (item.category) badges.push({ text: item.category, className: 'bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full' });
    if (item.unit) badges.push({ text: formatUnitLabel(item.unit), className: 'bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200' });

    return {
      imageUrl: pickFirstImage(item.image_urls, item.category || item.title || 'NEWS', '3B82F6'),
      altText: item.title,
      placeholderText: item.category || 'NEWS',
      dateText: item.created_at ? formatDateJP(item.created_at) : '',
      badges,
      title: item.title,
      detailUrl: `/news/${item.id}`,
      summary: buildSummary(item.content, 110),
      ctaText: '詳しく読む'
    };
  }
  return null;
}


// トップページ
router.get('/', async (req, res, next) => {
  try {
    // データ取得
    const [activityRes, newsRes] = await Promise.all([
      db.pool.query('SELECT * FROM activities ORDER BY activity_date DESC, created_at DESC LIMIT 3'),
      db.pool.query('SELECT * FROM news ORDER BY created_at DESC LIMIT 3')
    ]);

    // カード表示用にデータを整形
    const activities = activityRes.rows.map(item => shapeCardData(item, 'activity'));
    const news = newsRes.rows.map(item => shapeCardData(item, 'news'));

    // SEO情報生成
    const seo = buildSEOData('/', res.locals.siteConfig);

    // レンダリング
    res.render('pages/index', {
      title: seo.title,
      description: seo.description,
      seo,
      activities,
      news,
      pageScripts: [] // ヒーロー等のアニメーションはcommon-scripts.jsで処理
    });
  } catch (err) {
    console.error("Error fetching data for top page:", err);
    next(err);
  }
});

// 詳細ページ (SSR)
router.get('/news/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!id || isNaN(Number(id))) return next(); // 404へ

  try {
    const { rows } = await db.pool.query('SELECT * FROM news WHERE id = $1', [id]);
    if (rows.length === 0) return next();

    const item = rows[0];

    // ニュース詳細ページ用の動的SEO
    const siteSettings = {
      seo_site_url: res.locals.siteConfig?.get('seo_site_url') || 'https://www.tajimibs.org',
      seo_og_image_url: pickFirstImage(item.image_urls, item.title) || res.locals.siteConfig?.get('seo_og_image_url')
    };

    const seo = {
      title: `${item.title} | お知らせ | ボーイスカウト多治見第一団`,
      description: buildSummary(item.content, 150),
      keywords: 'お知らせ,ニュース,多治見,ボーイスカウト',
      robots: 'index, follow',
      canonical: `${siteSettings.seo_site_url}/news/${id}`,
      ogType: 'article',
      ogTitle: `${item.title} | お知らせ`,
      ogImage: siteSettings.seo_og_image_url,
      twitterCard: 'summary_large_image',
      siteName: 'ボーイスカウト多治見第一団'
    };

    // パンくずリスト
    const breadcrumbs = [
      { name: 'ホーム', url: '/' },
      { name: 'お知らせ一覧', url: '/news-list' },
      { name: item.title, url: `/news/${id}` }
    ];

    // JSON-LD生成 (breadcrumbsを含む)
    seo.jsonLD = generateFullJsonLD(`/news/${id}`, siteSettings, breadcrumbs);

    res.render('pages/news-detail', {
      title: seo.title,
      description: seo.description,
      seo,
      item,
      helpers,
      breadcrumbs
    });
  } catch (err) {
    next(err);
  }
});

router.get('/activity/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!id || isNaN(Number(id))) return next(); // 404へ

  try {
    const { rows } = await db.pool.query('SELECT * FROM activities WHERE id = $1', [id]);
    if (rows.length === 0) return next();

    const item = rows[0];

    // 活動詳細ページ用の動的SEO
    const siteSettings = {
      seo_site_url: res.locals.siteConfig?.get('seo_site_url') || 'https://www.tajimibs.org',
      seo_og_image_url: pickFirstImage(item.image_urls, item.title) || res.locals.siteConfig?.get('seo_og_image_url')
    };

    const seo = {
      title: `${item.title} | 活動記録 | ボーイスカウト多治見第一団`,
      description: buildSummary(item.content, 150),
      keywords: '活動記録,キャンプ,野外活動,多治見,ボーイスカウト',
      robots: 'index, follow',
      canonical: `${siteSettings.seo_site_url}/activity/${id}`,
      ogType: 'article',
      ogTitle: `${item.title} | 活動記録`,
      ogImage: siteSettings.seo_og_image_url,
      twitterCard: 'summary_large_image',
      siteName: 'ボーイスカウト多治見第一団'
    };

    // パンくずリスト
    const breadcrumbs = [
      { name: 'ホーム', url: '/' },
      { name: '活動記録一覧', url: '/activity-log' }, // 一覧ページ
      { name: item.title, url: `/activity/${id}` }
    ];

    // JSON-LD生成 (breadcrumbsを含む)
    seo.jsonLD = generateFullJsonLD(`/activity/${id}`, siteSettings, breadcrumbs);

    res.render('pages/activity-detail', {
      title: seo.title,
      description: seo.description,
      seo,
      item,
      helpers,
      breadcrumbs
    });
  } catch (err) {
    next(err);
  }
});

// 「団について」ページ
router.get('/about', (req, res) => {
  const seo = buildSEOData('/about', res.locals.siteConfig);
  res.render('pages/about', {
    title: seo.title,
    description: seo.description,
    seo,
    pageScripts: [] // 動的コンテンツはcommon-scripts.jsで処理
  });
});

// 静的ページ用の汎用ルーター
const staticPages = {
  'activity-log': '活動記録',
  'contact': 'お問い合わせ',
  'join': '入団案内',
  'news-list': 'お知らせ一覧',
  'privacy': 'プライバシーポリシー',

  'unit-beaver': 'ビーバー隊の紹介',
  'unit-cub': 'カブ隊の紹介',
  'unit-boy': 'ボーイ隊の紹介',
  'unit-venture': 'ベンチャー隊の紹介',
  'unit-rover': 'ローバー隊の紹介',

};

Object.entries(staticPages).forEach(([page, title]) => {
  router.get([`/${page}`, `/${page}.html`], (req, res) => {
    let pageScripts = [];
    if (page === 'activity-log') {
      pageScripts = ['/list-dashboard-base.js', '/activity-list.js'];
    } else if (page === 'news-list') {
      pageScripts = ['/list-dashboard-base.js', '/news-list.js'];
    } else if (page === 'contact') {
      pageScripts = ['/contact-form.js'];
    } else if (page.startsWith('unit-')) {
      pageScripts = ['/dynamic-unit-activities.js'];
    }

    // SEO情報生成（.htmlアクセスの場合は正規化されたパスを使用）
    const normalizedPath = `/${page}`;
    const seo = buildSEOData(normalizedPath, res.locals.siteConfig);

    res.render(`pages/${page}`, {
      title: seo.title,
      description: seo.description,
      seo,
      pageScripts
    });
  });
});


module.exports = router;