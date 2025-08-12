// src/routes/dashboardWebhook.js
const express = require('express');
const router = express.Router();
const dashboardWebhookController = require('../controllers/dashboardWebhookController');

router.post('/', dashboardWebhookController.receiveFromBot);

module.exports = router;
