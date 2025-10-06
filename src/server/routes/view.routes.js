const express = require('express');
const router = express.Router();
const db = require('../database');
const {
  formatDateJP,
  pickFirstImage,
  buildSummary
} = require('../utils/template-helpers');


// Card Data Shaper
// DBから取得したデータをhighlightCardパーシャルが期待する形式に変換
const shapeCardData = (item, type) => {
  if (type === 'activity') {
    return {
      imageUrl: pickFirstImage(item.image_urls, item.category || item.title || '活動'),
      altText: item.title,
      dateText: item.activity_date ? formatDateJP(item.activity_date) : (item.created_at ? formatDateJP(item.created_at) : ''),
      badges: [],
      title: item.title,
      detailUrl: `/activity-detail-placeholder.html?id=${item.id}`,
      summary: buildSummary(item.content, 120),
      ctaText: '詳細を見る'
    };
  }
  if (type === 'news') {
    const badges = [];
    if (item.category) badges.push({ text: item.category, className: 'bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full' });
    if (item.unit) badges.push({ text: item.unit, className: 'bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200' });

    return {
      imageUrl: pickFirstImage(item.image_urls, item.category || item.title || 'NEWS', '3B82F6'),
      altText: item.title,
      dateText: item.created_at ? formatDateJP(item.created_at) : '',
      badges,
      title: item.title,
      detailUrl: `/news-detail-placeholder.html?id=${item.id}`,
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

    // レンダリング
    res.render('pages/index', {
      title: 'ボーイスカウト多治見第一団 - トップページ',
      description: 'ボーイスカウト多治見第一団の公式ウェブサイトへようこそ。自然体験、仲間との協力、そして自己成長の機会を提供します。',
      activities,
      news,
      pageScripts: ['/dynamic-index.js'] // ヒーローセクションのアニメーション等に必要
    });
  } catch (err) {
    console.error("Error fetching data for top page:", err);
    next(err);
  }
});

// 「団について」ページ
router.get('/about', (req, res) => {
  res.render('pages/about', {
    title: '私たちについて - ボーイスカウト多治見第一団',
    description: 'ボーイスカウト多治見第一団の理念、活動方針、指導者についてご紹介します。',
    pageScripts: ['/dynamic-about.js'] // 'about.ejs'で動的に読み込まれるコンテンツがある場合
  });
});

// 静的ページ用の汎用ルーター
const staticPages = {
  'activity-log': '活動記録',
  'contact': 'お問い合わせ',
  'join': '入団案内',
  'news-list': 'お知らせ一覧',
  'privacy': 'プライバシーポリシー',
  'sitemap': 'サイトマップ',
  'testimonials': '保護者・スカウトの声',
  'unit-beaver': 'ビーバー隊の紹介',
  'unit-cub': 'カブ隊の紹介',
  'unit-boy': 'ボーイ隊の紹介',
  'unit-venture': 'ベンチャー隊の紹介',
  'unit-rover': 'ローバー隊の紹介',
  'leaders-all': '指導者一覧'
};

Object.entries(staticPages).forEach(([page, title]) => {
  router.get(`/${page}`, (req, res) => {
    let pageScripts = [];
    if (page === 'activity-log') {
      pageScripts = ['/filters-dynamic.js', '/dynamic-activities.v2.js', '/enhance-activities.js'];
    } else if (page === 'news-list') {
      pageScripts = ['/filters-dynamic.js', '/dynamic-news.js', '/enhance-news.js'];
    } else if (page.startsWith('unit-')) {
      pageScripts = ['/dynamic-unit-activities.js'];
    } else if (page === 'news-detail-placeholder') {
      pageScripts = ['/lightbox.js', '/dynamic-news.js'];
    } else if (page === 'activity-detail-placeholder') {
      pageScripts = ['/lightbox.js', '/dynamic-activities.v2.js'];
    }
    res.render(`pages/${page}`, {
      title: `${title} - ボーイスカウト多治見第一団`,
      description: `ボーイスカウト多治見第一団の${title}ページです。`,
      pageScripts
    });
  });
});


module.exports = router;