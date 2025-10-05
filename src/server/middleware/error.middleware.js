// src/server/middleware/error.middleware.js

/**
 * Express 縲ｨ繝ｩ繝ｼ蜃ｦ逅繝溘ラ繝ｫ繧ｦ繧ｧ繧｢
 *
 * @param {Error} err - Express 縺ｫ繧医▲縺ｦ繧ｭ繝｣繝繝√輔∪縺溘◆繧ｨ繝ｩ繝ｼ繧ｪ繝悶ず繧ｧ繧ｯ繝
 * @param {import('express').Request} req - Express 繝ｪ繧ｯ繧ｨ繧ｹ繝医い繝悶ず繧ｧ繧ｯ繝
 * @param {import('express').Response} res - Express 繝ｬ繧ｹ繝昴Φ繧ｹ繧ｪ繝悶ず繧ｧ繧ｯ繝
 * @param {import('express').NextFunction} next - Express next髢｢謨ｰ
 */
function errorHandler(err, req, res, next) {
  // 縲ｨ繝ｩ繝ｼ繧定｣ｰ繝昴繝ｫ縺ｫ蜃ｺ蜉帙蛻ｰ逡ｪ遉ｾ縺ｧ縺ｯ繧医ｊ隧ｳ邏ｰ縺ｪ繝ｭ繧ｮ繝ｳ繧ｰ繧定検遉ｾ縲
  console.error('Global Error Handler:', err);

  // 繝帙ャ繝繝ｼ縺後☆縺ｧ縺ｫ騾∽ｿ｡縺輔ｌ縺ｦ縺ｋ蝣ｴ蜷医縲Express縺ｮ繝ヵ繧ｩ繝ｫ繝医ヰ繝ｳ繝峨Λ縺ｫｰ螢ｲ
  if (res.headersSent) {
    return next(err);
  }

  // 豁｣讒倥↑繧ｨ繝ｩ繝ｼ繝ｬ繧ｹ繝昴Φ繧ｹ
  res.status(500).json({
    error: 'server_error',
    message: 'サーバー内部でエラーが発生しました。',
  });
}

module.exports = {
  errorHandler,
};