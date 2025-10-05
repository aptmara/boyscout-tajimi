const express = require('express');
const router = express.Router();

const { handleContactForm } = require('../controllers/contact.controller.js');

router.post('/', handleContactForm);

module.exports = router;
