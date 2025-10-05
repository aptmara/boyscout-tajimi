const express = require('express');
const router = express.Router();

const {
    getSettings,
    getPublicSettings,
    updateSettings,
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

module.exports = router;
