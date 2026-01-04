const express = require('express');
const router = express.Router();

const { handleContactForm } = require('../controllers/contact.controller.js');
const {
    contactRateLimiter,
    honeypotValidator,
    submissionTimeValidator
} = require('../middleware/contact-protection.js');

// 保護ミドルウェアを順番に適用
// 1. レート制限（DoS対策）
// 2. ハニーポット検証（ボット対策）
// 3. 送信時間検証（ボット対策）
router.post('/',
    contactRateLimiter,
    honeypotValidator,
    submissionTimeValidator,
    handleContactForm
);

module.exports = router;
