// Webhook Routes
const express = require('express');
const router = express.Router();

const messageController = require('../controllers/messageController');
const { validateMessage } = require('../middleware/validatePayload');

router.post('/whatsapp', validateMessage, messageController.webhook);

module.exports = router;
