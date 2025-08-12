// src/routes/contextTransfer.js
const express = require('express');
const router = express.Router();
const contextTransferController = require('../controllers/contextTransferController');

router.get('/context', contextTransferController.getContext);
router.post('/transfer', contextTransferController.transfer);

module.exports = router;
