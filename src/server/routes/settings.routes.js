const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload.middleware.js');
const {
    getSettings,
    getPublicSettings,
    updateSettings,
    uploadImage
} = require('../controllers/settings.controller.js');

const { authMiddleware, adminOnlyMiddleware } = require('../middleware/auth.middleware.js');

// Public route for settings needed by the front-end
router.get('/public', getPublicSettings);

// All subsequent routes are protected
router.use(authMiddleware);

// 参照は全ユーザーOK
router.get('/', getSettings);
router.get('/all', getSettings); // Alias for compatibility

// 更新は管理者のみ
router.put('/', adminOnlyMiddleware, updateSettings);
router.post('/', adminOnlyMiddleware, updateSettings); // Alias for compatibility

// Image Upload Route (管理者のみ)
router.post('/upload', adminOnlyMiddleware, upload.single('image'), uploadImage);

module.exports = router;
