const express = require('express');
const router = express.Router();

const {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  newsWebhook,
} = require('../controllers/news.controller.js');

const {
  authMiddleware,
  webhookAuth,
} = require('../middleware/auth.middleware.js');

// Middleware for parsing raw JSON body for webhook
const webhookRawJson = express.raw({ type: 'application/json', limit: '1mb' });

// Public routes
router.get('/', getAllNews);
router.get('/:id', getNewsById);

// Webhook route - Note: path is relative to where this router is mounted
router.post('/webhook', webhookRawJson, webhookAuth, newsWebhook);

// Protected (Admin) routes - Apply auth middleware individually
router.post('/', authMiddleware, createNews);
router.put('/:id', authMiddleware, updateNews);
router.delete('/:id', authMiddleware, deleteNews);

module.exports = router;
