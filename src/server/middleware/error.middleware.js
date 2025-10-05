// src/server/middleware/error.middleware.js

/**
 * Express グローバルエラー処理ミドルウェア
 *
 * @param {Error} err - Express によってキャッチされたエラーオブジェクト
 * @param {import('express').Request} req - Express リクエストオブジェクト
 * @param {import('express').Response} res - Express レスポンスオブジェクト
 * @param {import('express').NextFunction} next - Express next関数
 */
function errorHandler(err, req, res, next) {
  // エラーをコンソールに出力。本番環境ではより詳細なロギングを検討。
  console.error('Global Error Handler:', err.message);
  console.error(err.stack);

  // ヘッダーがすでに送信されている場合、Expressのデフォルトハンドラに委譲
  if (res.headersSent) {
    return next(err);
  }

  // 汎用的なエラーレスポンス
  res.status(500).json({
    error: 'server_error',
    message: 'サーバー内部でエラーが発生しました。',
  });
}

module.exports = {
  errorHandler,
};