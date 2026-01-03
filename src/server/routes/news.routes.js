const express = require('express');
const router = express.Router();

const {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  getNewsFilters,
} = require('../controllers/news.controller.js');

const { authMiddleware } = require('../middleware/auth.middleware.js');

// Public routes
router.get('/filters', getNewsFilters);
router.get('/', getAllNews);
router.get('/:id', getNewsById);

// Protected (Admin) routes - Apply auth middleware individually
router.post('/', authMiddleware, createNews);
router.put('/:id', authMiddleware, updateNews);
router.delete('/:id', authMiddleware, deleteNews);

module.exports = router;
