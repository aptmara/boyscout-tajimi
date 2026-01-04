/**
 * レート制限ミドルウェア
 * DoS攻撃・荒らし対策用
 * 
 * - 同一IPからの短時間での大量リクエストを制限
 * - メモリベースの簡易実装（サーバー再起動でリセット）
 */

// IPごとのリクエスト履歴を保持
const requestCounts = new Map();

// 設定
const RATE_LIMIT_CONFIG = {
    // 短期制限: 1分間に最大3回
    shortWindow: 60 * 1000,      // 1分
    shortMaxRequests: 3,

    // 長期制限: 1時間に最大10回
    longWindow: 60 * 60 * 1000,  // 1時間
    longMaxRequests: 10,

    // クリーンアップ間隔
    cleanupInterval: 10 * 60 * 1000  // 10分
};

/**
 * 古いエントリをクリーンアップ
 */
function cleanupOldEntries() {
    const now = Date.now();
    for (const [ip, data] of requestCounts.entries()) {
        // 長期ウィンドウより古いエントリを削除
        data.timestamps = data.timestamps.filter(
            ts => now - ts < RATE_LIMIT_CONFIG.longWindow
        );

        // タイムスタンプが空になったIPを削除
        if (data.timestamps.length === 0) {
            requestCounts.delete(ip);
        }
    }
}

// 定期クリーンアップ
setInterval(cleanupOldEntries, RATE_LIMIT_CONFIG.cleanupInterval);

/**
 * IPアドレスを取得（プロキシ対応）
 */
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // 複数のIPがある場合、最初のものを使用
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * レート制限ミドルウェア
 */
function contactRateLimiter(req, res, next) {
    const clientIP = getClientIP(req);
    const now = Date.now();

    // このIPの履歴を取得または初期化
    if (!requestCounts.has(clientIP)) {
        requestCounts.set(clientIP, { timestamps: [] });
    }

    const data = requestCounts.get(clientIP);

    // 古いタイムスタンプを削除
    data.timestamps = data.timestamps.filter(
        ts => now - ts < RATE_LIMIT_CONFIG.longWindow
    );

    // 短期制限チェック
    const recentRequests = data.timestamps.filter(
        ts => now - ts < RATE_LIMIT_CONFIG.shortWindow
    );

    if (recentRequests.length >= RATE_LIMIT_CONFIG.shortMaxRequests) {
        console.warn(`[RateLimit] 短期制限超過: IP=${clientIP}, count=${recentRequests.length}`);
        return res.status(429).json({
            error: 'rate_limit_exceeded',
            message: '送信回数の上限に達しました。しばらく時間をおいてから再度お試しください。',
            retryAfter: Math.ceil((RATE_LIMIT_CONFIG.shortWindow - (now - recentRequests[0])) / 1000)
        });
    }

    // 長期制限チェック
    if (data.timestamps.length >= RATE_LIMIT_CONFIG.longMaxRequests) {
        console.warn(`[RateLimit] 長期制限超過: IP=${clientIP}, count=${data.timestamps.length}`);
        return res.status(429).json({
            error: 'rate_limit_exceeded',
            message: '本日の送信回数の上限に達しました。明日以降に再度お試しください。',
            retryAfter: Math.ceil((RATE_LIMIT_CONFIG.longWindow - (now - data.timestamps[0])) / 1000)
        });
    }

    // リクエストを記録
    data.timestamps.push(now);

    next();
}

/**
 * ハニーポット検証ミドルウェア
 * 隠しフィールド(website)に値が入っていたらボットと判定
 */
function honeypotValidator(req, res, next) {
    const honeypotValue = req.body?.website || req.body?.url || req.body?.hp_field;

    if (honeypotValue && honeypotValue.trim() !== '') {
        console.warn(`[Honeypot] ボット検出: IP=${getClientIP(req)}, honeypot="${honeypotValue}"`);
        // ボットには成功したように見せかける（再試行を防ぐ）
        return res.status(200).json({
            message: 'お問い合わせありがとうございます。'
        });
    }

    next();
}

/**
 * 送信時間チェックミドルウェア
 * フォーム表示から送信までの時間が短すぎる場合はボットと判定
 */
function submissionTimeValidator(req, res, next) {
    const formLoadedAt = req.body?._formLoadedAt;

    // フォーム読み込み時刻がない場合はスキップ（後方互換性）
    if (!formLoadedAt) {
        return next();
    }

    const loadedTime = parseInt(formLoadedAt, 10);
    if (isNaN(loadedTime)) {
        return next();
    }

    const now = Date.now();
    const elapsed = now - loadedTime;

    // 3秒未満は人間には不可能
    const MIN_SUBMISSION_TIME = 3000;

    if (elapsed < MIN_SUBMISSION_TIME) {
        console.warn(`[TimeCheck] 送信時間が短すぎ: IP=${getClientIP(req)}, elapsed=${elapsed}ms`);
        // ボットには成功したように見せかける
        return res.status(200).json({
            message: 'お問い合わせありがとうございます。'
        });
    }

    next();
}

module.exports = {
    contactRateLimiter,
    honeypotValidator,
    submissionTimeValidator,
    getClientIP
};
