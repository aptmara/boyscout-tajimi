const express = require('express');
const router = express.Router();

const {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
} = require('../controllers/activity.controller.js');

const { authMiddleware } = require('../middleware/auth.middleware.js');

// Public routes
router.get('/', getAllActivities);
router.get('/:id', getActivityById);

// All subsequent routes in this router will be protected by the authMiddleware
router.use(authMiddleware);

router.post('/', createActivity);
router.put('/:id', updateActivity);
router.delete('/:id', deleteActivity);

module.exports = router;
