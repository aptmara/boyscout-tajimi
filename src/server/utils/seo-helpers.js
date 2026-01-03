/**
 * SEOヘルパー関数
 * ページごとのメタ情報、OGP、構造化データを生成
 */

const SITE_URL = 'https://www.tajimibs.org';

/**
 * ページ別SEO設定
 * 各ページに最適化されたメタ情報を定義
 */
const pageSEOConfig = {
    '/': {
        title: 'ボーイスカウト多治見第一団 | 岐阜県多治見市の青少年育成',
        description: 'ボーイスカウト多治見第一団の公式サイト。岐阜県多治見市を拠点に、ビーバー隊・カブ隊・ボーイ隊・ベンチャー隊・ローバー隊が活動中。自然体験、野外活動を通じて青少年の健全育成を行っています。見学・体験入隊随時受付中。',
        keywords: 'ボーイスカウト,多治見,岐阜県,青少年育成,野外活動,キャンプ,自然体験,ビーバースカウト,カブスカウト',
        ogType: 'website'
    },
    '/about': {
        title: '団について | ボーイスカウト多治見第一団',
        description: '昭和39年（1964年）創立。60年以上の歴史を持つボーイスカウト多治見第一団の理念、活動方針、指導者をご紹介します。日本ボーイスカウト岐阜県連盟所属。',
        keywords: 'ボーイスカウト多治見,団紹介,歴史,理念,岐阜県連盟,指導者',
        ogType: 'article'
    },
    '/unit-venture': {
        title: 'ベンチャー隊 | 高校生のスカウト活動 | ボーイスカウト多治見第一団',
        description: 'ベンチャースカウトは高校生年代（中3・9月〜20歳未満）の部門。「われらはパイオニア」を合言葉に、自主プロジェクト活動、長期キャンプ、雪山登山、リーダーシップ訓練に挑戦。岐阜県多治見市で活動中。',
        keywords: 'ベンチャースカウト,高校生,多治見,ボーイスカウト,プロジェクト活動,リーダーシップ,野外活動,岐阜県',
        ogType: 'article'
    },
    '/unit-beaver': {
        title: 'ビーバー隊 | 年長〜小2のスカウト活動 | ボーイスカウト多治見第一団',
        description: 'ビーバースカウトは年長〜小学2年生が対象。「みんなと仲良く遊ぶ」をモットーに、自然探検、工作、歌やゲームを通じて豊かな感性と協調性を育みます。岐阜県多治見市で活動中。',
        keywords: 'ビーバースカウト,年長,小学生,多治見,ボーイスカウト,自然体験,岐阜県',
        ogType: 'article'
    },
    '/unit-cub': {
        title: 'カブ隊 | 小3〜小5のスカウト活動 | ボーイスカウト多治見第一団',
        description: 'カブスカウトは小学3〜5年生が対象。「いつも元気」をモットーに、組活動を通じて協力する力、挑戦する心を育みます。岐阜県多治見市で活動中。',
        keywords: 'カブスカウト,小学生,多治見,ボーイスカウト,野外活動,岐阜県',
        ogType: 'article'
    },
    '/unit-boy': {
        title: 'ボーイ隊 | 小6〜中3のスカウト活動 | ボーイスカウト多治見第一団',
        description: 'ボーイスカウトは小学6年生〜中学3年生が対象。「そなえよつねに」をモットーに、班活動を通じて計画性、リーダーシップ、野外技能を習得。岐阜県多治見市で活動中。',
        keywords: 'ボーイスカウト,中学生,小学生,多治見,班活動,キャンプ,岐阜県',
        ogType: 'article'
    },
    '/unit-rover': {
        title: 'ローバー隊 | 18〜25歳のスカウト活動 | ボーイスカウト多治見第一団',
        description: 'ローバースカウトは18〜25歳が対象。社会奉仕を実践し、自己の確立とより良い社会の実現を目指します。岐阜県多治見市で活動中。',
        keywords: 'ローバースカウト,大学生,社会人,多治見,ボーイスカウト,奉仕活動,岐阜県',
        ogType: 'article'
    },
    '/join': {
        title: '入団案内 | ボーイスカウト多治見第一団',
        description: 'ボーイスカウト多治見第一団への入団方法、活動費用、必要な持ち物をご案内。見学・体験入隊は随時受付中。年長さんから大人まで、一緒に冒険しませんか？',
        keywords: '入団案内,見学,体験入隊,費用,多治見,ボーイスカウト',
        ogType: 'article'
    },
    '/contact': {
        title: 'お問い合わせ | ボーイスカウト多治見第一団',
        description: 'ボーイスカウト多治見第一団へのお問い合わせフォーム。活動に関するご質問、見学・体験入隊のお申し込みなど、お気軽にお問い合わせください。',
        keywords: 'お問い合わせ,見学申込,体験入隊,多治見,ボーイスカウト',
        ogType: 'website'
    },
    '/activity-log': {
        title: '活動記録 | ボーイスカウト多治見第一団',
        description: 'ボーイスカウト多治見第一団の活動記録。キャンプ、ハイキング、奉仕活動など、各隊の活動報告をご覧いただけます。',
        keywords: '活動記録,キャンプ,ハイキング,奉仕活動,多治見,ボーイスカウト',
        ogType: 'website'
    },
    '/news-list': {
        title: 'お知らせ | ボーイスカウト多治見第一団',
        description: 'ボーイスカウト多治見第一団からのお知らせ、イベント情報、募集案内をお届けします。',
        keywords: 'お知らせ,イベント,募集,多治見,ボーイスカウト',
        ogType: 'website'
    },
    '/privacy': {
        title: 'プライバシーポリシー | ボーイスカウト多治見第一団',
        description: 'ボーイスカウト多治見第一団の個人情報保護方針。',
        keywords: 'プライバシーポリシー,個人情報保護',
        ogType: 'article'
    },
    '/sitemap': {
        title: 'サイトマップ | ボーイスカウト多治見第一団',
        description: 'ボーイスカウト多治見第一団公式サイトのページ一覧。',
        keywords: 'サイトマップ',
        ogType: 'website'
    },
    '/testimonials': {
        title: '保護者・スカウトの声 | ボーイスカウト多治見第一団',
        description: '実際に活動しているスカウトや保護者の方々からの声をご紹介。ボーイスカウト活動の魅力をお伝えします。',
        keywords: '保護者の声,体験談,口コミ,多治見,ボーイスカウト',
        ogType: 'article'
    }
};

/**
 * パンくずリストの定義
 */
const breadcrumbConfig = {
    '/unit-venture': [
        { name: 'ホーム', url: '/' },
        { name: '各隊の紹介', url: '/#units' },
        { name: 'ベンチャー隊', url: '/unit-venture' }
    ],
    '/unit-beaver': [
        { name: 'ホーム', url: '/' },
        { name: '各隊の紹介', url: '/#units' },
        { name: 'ビーバー隊', url: '/unit-beaver' }
    ],
    '/unit-cub': [
        { name: 'ホーム', url: '/' },
        { name: '各隊の紹介', url: '/#units' },
        { name: 'カブ隊', url: '/unit-cub' }
    ],
    '/unit-boy': [
        { name: 'ホーム', url: '/' },
        { name: '各隊の紹介', url: '/#units' },
        { name: 'ボーイ隊', url: '/unit-boy' }
    ],
    '/unit-rover': [
        { name: 'ホーム', url: '/' },
        { name: '各隊の紹介', url: '/#units' },
        { name: 'ローバー隊', url: '/unit-rover' }
    ],
    '/about': [
        { name: 'ホーム', url: '/' },
        { name: '団について', url: '/about' }
    ],
    '/join': [
        { name: 'ホーム', url: '/' },
        { name: '入団案内', url: '/join' }
    ],
    '/contact': [
        { name: 'ホーム', url: '/' },
        { name: 'お問い合わせ', url: '/contact' }
    ]
};

/**
 * SEO情報を生成
 * @param {string} path - ページパス
 * @param {object} siteSettings - DB設定から取得したサイト設定
 * @returns {object} SEO情報オブジェクト
 */
function generateSEO(path, siteSettings = {}) {
    const config = pageSEOConfig[path] || {};
    const siteUrl = siteSettings.seo_site_url || SITE_URL;
    const siteName = siteSettings.seo_site_name || 'ボーイスカウト多治見第一団';
    const defaultOgImage = siteSettings.seo_og_image_url || `${siteUrl}/images/og-default.jpg`;

    return {
        title: config.title || `${siteName}`,
        description: config.description || siteSettings.seo_default_description || '',
        keywords: config.keywords || siteSettings.seo_default_keywords || '',
        robots: 'index, follow',
        canonical: `${siteUrl}${path}`,
        ogType: config.ogType || 'website',
        ogTitle: config.title || siteName,
        ogImage: defaultOgImage,
        twitterCard: siteSettings.seo_twitter_card_type || 'summary_large_image',
        siteUrl,
        siteName
    };
}

/**
 * 組織の構造化データを生成
 * @param {object} siteSettings - DB設定
 * @returns {object} Organization JSON-LD
 */
function generateOrganizationLD(siteSettings = {}) {
    const siteUrl = siteSettings.seo_site_url || SITE_URL;
    const organization = {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        "name": siteSettings.seo_organization_name || "ボーイスカウト多治見第一団",
        "url": siteUrl,
        "logo": siteSettings.group_crest_url || `${siteUrl}/images/logo.png`,
        "foundingDate": siteSettings.seo_organization_founding_date || "1964",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "多治見市",
            "addressRegion": "岐阜県",
            "addressCountry": "JP"
        },
        "parentOrganization": {
            "@type": "Organization",
            "name": "日本ボーイスカウト岐阜県連盟"
        },
        "sameAs": []
    };

    if (siteSettings.seo_social_facebook) organization.sameAs.push(siteSettings.seo_social_facebook);
    if (siteSettings.seo_social_instagram) organization.sameAs.push(siteSettings.seo_social_instagram);
    if (siteSettings.seo_social_twitter) organization.sameAs.push(siteSettings.seo_social_twitter);
    if (siteSettings.seo_social_line) organization.sameAs.push(siteSettings.seo_social_line);

    if (siteSettings.seo_social_links) {
        const links = siteSettings.seo_social_links.split(',').map(s => s.trim()).filter(s => s);
        organization.sameAs.push(...links);
    }
    // Remove duplicates
    organization.sameAs = [...new Set(organization.sameAs)];

    return organization;
}

/**
 * パンくずリストの構造化データを生成
 * @param {string} path - ページパス
 * @param {object} siteSettings - DB設定
 * @param {Array} dynamicBreadcrumbs - 動的に生成されたパンくずリスト項目 [{name, url}]
 * @returns {object|null} BreadcrumbList JSON-LD
 */
function generateBreadcrumbLD(path, siteSettings = {}, dynamicBreadcrumbs = null) {
    const items = dynamicBreadcrumbs || breadcrumbConfig[path];
    if (!items) return null;

    const siteUrl = siteSettings.seo_site_url || SITE_URL;

    return {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}${path}#breadcrumb`,
        "itemListElement": items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`
        }))
    };
}

/**
 * ページの構造化データを生成
 * @param {string} path - ページパス
 * @param {object} siteSettings - DB設定
 * @param {boolean} hasBreadcrumbs - パンくずが存在するかどうか
 * @returns {object} WebPage JSON-LD
 */
function generateWebPageLD(path, siteSettings = {}, hasBreadcrumbs = false) {
    const config = pageSEOConfig[path] || {};
    const siteUrl = siteSettings.seo_site_url || SITE_URL;

    const webPage = {
        "@type": "WebPage",
        "@id": `${siteUrl}${path}#webpage`,
        "url": `${siteUrl}${path}`,
        "name": config.title || '',
        "description": config.description || '',
        "isPartOf": { "@id": `${siteUrl}/#website` },
        "inLanguage": "ja"
    };

    // パンくずがあれば追加
    if (breadcrumbConfig[path] || hasBreadcrumbs) {
        webPage.breadcrumb = { "@id": `${siteUrl}${path}#breadcrumb` };
    }

    return webPage;
}

/**
 * 完全な構造化データ（@graph形式）を生成
 * @param {string} path - ページパス
 * @param {object} siteSettings - DB設定
 * @param {Array} dynamicBreadcrumbs - 動的なパンくずリスト項目（オプション）
 * @returns {string} JSON-LD文字列
 */
function generateFullJsonLD(path, siteSettings = {}, dynamicBreadcrumbs = null) {
    const siteUrl = siteSettings.seo_site_url || SITE_URL;
    const siteName = siteSettings.seo_site_name || 'ボーイスカウト多治見第一団';
    const hasBreadcrumbs = !!(dynamicBreadcrumbs || breadcrumbConfig[path]);

    const graph = [
        // WebSite
        {
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            "url": siteUrl,
            "name": siteName,
            "description": siteSettings.seo_default_description || '',
            "publisher": { "@id": `${siteUrl}/#organization` },
            "inLanguage": "ja"
        },
        // Organization
        generateOrganizationLD(siteSettings),
        // WebPage
        generateWebPageLD(path, siteSettings, hasBreadcrumbs)
    ];

    // パンくずリスト追加
    const breadcrumb = generateBreadcrumbLD(path, siteSettings, dynamicBreadcrumbs);
    if (breadcrumb) {
        graph.push(breadcrumb);
    }

    return JSON.stringify({
        "@context": "https://schema.org",
        "@graph": graph
    }, null, 2);
}

module.exports = {
    pageSEOConfig,
    breadcrumbConfig,
    generateSEO,
    generateOrganizationLD,
    generateBreadcrumbLD,
    generateWebPageLD,
    generateFullJsonLD,
    SITE_URL
};
