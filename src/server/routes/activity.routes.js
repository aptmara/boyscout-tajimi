const express = require('express');
const router = express.Router();

const {
    getAllActivities,
    getActivityById,
    createActivity,
    updateActivity,
    deleteActivity,
    activityWebhook,
} = require('../controllers/activity.controller.js');

const {
  authMiddleware,
  webhookAuth,
} = require('../middleware/auth.middleware.js');

// Middleware for parsing raw JSON body for webhook
const webhookRawJson = express.raw({ type: 'application/json', limit: '1mb' });

// Public routes
router.get('/', getAllActivities);
router.get('/:id', getActivityById);

// Webhook route
router.post('/webhook', webhookRawJson, webhookAuth, activityWebhook);

// All subsequent routes in this router will be protected by the authMiddleware
router.use(authMiddleware);

router.post('/', createActivity);
router.put('/:id', updateActivity);
router.delete('/:id', deleteActivity);

module.exports = router;
