// src/routes/humanQueue.js
const express = require('express');
const router = express.Router();
const humanQueueController = require('../controllers/humanQueueController');

router.post('/join', humanQueueController.join);
router.post('/leave', humanQueueController.leave);
router.get('/position', humanQueueController.position);
router.get('/', humanQueueController.queue);

module.exports = router;
