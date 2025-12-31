const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload.middleware.js');
const {
    getSettings,
    getPublicSettings,
    updateSettings,
    uploadImage
} = require('../controllers/settings.controller.js');

const { authMiddleware } = require('../middleware/auth.middleware.js');

// Public route for settings needed by the front-end
router.get('/public', getPublicSettings);

// All subsequent routes are protected
router.use(authMiddleware);

router.get('/', getSettings);
router.get('/all', getSettings); // Alias for compatibility
router.put('/', updateSettings);
router.post('/', updateSettings); // Alias for compatibility

// Image Upload Route
router.post('/upload', upload.single('image'), uploadImage);

module.exports = router;
