/**
 * 監査ログ用ミドルウェア・ユーティリティ
 * 重要な操作（バックアップ、設定変更など）を記録
 */

const db = require('../database');

/**
 * IPアドレス取得（プロキシ対応）
 */
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * 監査ログを記録
 * @param {Object} options
 * @param {string} options.action - 操作種別 (backup_download, settings_change, login, etc.)
 * @param {string} options.username - 操作ユーザー名
 * @param {string} options.ipAddress - IPアドレス
 * @param {string} [options.details] - 追加詳細（JSON文字列可）
 * @param {string} [options.status] - 結果 (success, failed, etc.)
 */
async function logAudit({ action, username, ipAddress, details = '', status = 'success' }) {
    try {
        await db.query(
            `INSERT INTO audit_logs (action, username, ip_address, details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [action, username, ipAddress, details, status]
        );
    } catch (err) {
        // ログ記録失敗は致命的ではないが、コンソールには出力
        console.error('[Audit] Failed to log:', err.message, { action, username, ipAddress });
    }
}

/**
 * パスワード再認証ミドルウェア
 * リクエストボディまたはクエリパラメータから password を取得して検証
 */
const bcrypt = require('bcrypt');

async function requirePasswordReauth(req, res, next) {
    const password = req.body?.password || req.query?.password;

    if (!password) {
        return res.status(401).json({
            error: 'password_required',
            message: 'この操作にはパスワードの再入力が必要です。'
        });
    }

    const username = req.session?.user?.username;
    if (!username) {
        return res.status(401).json({
            error: 'not_authenticated',
            message: 'ログインが必要です。'
        });
    }

    try {
        const { rows } = await db.query(
            'SELECT password FROM admins WHERE username = $1',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                error: 'user_not_found',
                message: 'ユーザーが見つかりません。'
            });
        }

        const isValid = await bcrypt.compare(password, rows[0].password);
        if (!isValid) {
            // 失敗もログに記録
            await logAudit({
                action: 'reauth_failed',
                username,
                ipAddress: getClientIP(req),
                details: `URL: ${req.originalUrl}`,
                status: 'failed'
            });

            return res.status(401).json({
                error: 'invalid_password',
                message: 'パスワードが正しくありません。'
            });
        }

        // 認証成功
        next();
    } catch (err) {
        console.error('[Reauth] Error:', err);
        return res.status(500).json({
            error: 'server_error',
            message: 'サーバーエラーが発生しました。'
        });
    }
}

module.exports = {
    getClientIP,
    logAudit,
    requirePasswordReauth
};
