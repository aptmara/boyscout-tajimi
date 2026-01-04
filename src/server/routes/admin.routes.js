const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { downloadBackup, getSummary, getAuditLogs } = require('../controllers/admin.controller');
const { requirePasswordReauth } = require('../middleware/audit.middleware');

// 全てのエンドポイントで認証を要求
router.use(authMiddleware);

// バックアップダウンロード（パスワード再認証必須）
// POSTに変更してパスワードをBody経由で受け取る
router.post('/backup', requirePasswordReauth, downloadBackup);

// ダッシュボードサマリー
router.get('/summary', getSummary);

// 監査ログ取得
router.get('/audit-logs', getAuditLogs);

module.exports = router;
