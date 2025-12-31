const db = require('../database.js');
const SITE_CONFIG_KEYS = require('../utils/siteConfigKeys.js');

// 毎回DBから設定を取得して res.locals にセットするミドルウェア
// パフォーマンスが気になる場合は、オンメモリキャッシュを検討する
const loadSiteSettings = async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT key, value FROM site_settings');

        const config = {};
        for (const r of rows) {
            config[r.key] = r.value || '';
        }

        // デフォルト値のフォールバック（キーが存在しない場合）
        // プレースホルダー画像ロジックなどを一元化するために、ヘルパー関数も注入
        res.locals.siteConfig = {
            values: config, // 生の値
            get: (key, defaultVal) => {
                return config[key] || defaultVal || '';
            },
            // 画像取得用ヘルパー（プレースホルダー対応）
            getImage: (key, defaultPlaceholder = 'https://placehold.co/600x400?text=No+Image') => {
                const val = config[key];
                if (val && val.trim() !== '') return val;
                return defaultPlaceholder;
            },
            keys: SITE_CONFIG_KEYS // EJS側でキーを参照したい場合用
        };

        next();
    } catch (err) {
        console.error('Core Middleware Error: Failed to load site settings:', err);
        // 致命的なエラーだが、サイト自体は動くように空の設定で続行
        res.locals.siteConfig = { values: {}, get: () => '', getImage: (_, d) => d };
        next();
    }
};

module.exports = { loadSiteSettings };
