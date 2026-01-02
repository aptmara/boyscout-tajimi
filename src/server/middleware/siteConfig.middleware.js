const db = require('../database.js');
const SITE_CONFIG_KEYS = require('../utils/siteConfigKeys.js');

// Simple In-Memory Cache
let settingsCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// 毎回DBから設定を取得して res.locals にセットするミドルウェア
// パフォーマンス向上のためオンメモリキャッシュを実装
const loadSiteSettings = async (req, res, next) => {
    try {
        const now = Date.now();

        // キャッシュが有効ならそれを使う
        if (settingsCache && (now - lastCacheTime < CACHE_TTL)) {
            applySettingsToLocals(res, settingsCache);
            return next();
        }

        const { rows } = await db.query('SELECT key, value FROM site_settings');

        const config = {};
        for (const r of rows) {
            config[r.key] = r.value || '';
        }

        // キャッシュ更新
        settingsCache = config;
        lastCacheTime = now;

        applySettingsToLocals(res, config);
        next();
    } catch (err) {
        console.error('Core Middleware Error: Failed to load site settings:', err);
        // DBエラー時はキャッシュがあればそれを使う、なければ空で続行
        if (settingsCache) {
            applySettingsToLocals(res, settingsCache);
        } else {
            res.locals.siteConfig = { values: {}, get: () => '', getImage: (_, d) => d };
        }
        next();
    }
};

function applySettingsToLocals(res, config) {
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
}

module.exports = { loadSiteSettings };
