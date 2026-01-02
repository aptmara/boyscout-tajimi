const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { downloadBackup } = require('../controllers/admin.controller');

// 全てのエンドポイントで認証を要求
router.use(authMiddleware);

// バックアップダウンロード
router.get('/backup', downloadBackup);

// ダッシュボードサマリー
router.get('/summary', require('../controllers/admin.controller').getSummary);

module.exports = router;
