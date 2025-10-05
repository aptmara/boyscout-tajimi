const express = require('express');
const router = express.Router();

const {
    login,
    logout,
    getSession,
} = require('../controllers/auth.controller.js');

router.post('/login', login);
router.post('/logout', logout);
router.get('/session', getSession);

module.exports = router;
