const express = require('express');
const router = express.Router();

const { getSummary } = require('../controllers/admin.controller.js');
const { authMiddleware } = require('../middleware/auth.middleware.js');

// All routes in this file are protected
router.use(authMiddleware);

router.get('/summary', getSummary);

module.exports = router;
