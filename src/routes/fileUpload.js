// src/routes/fileUpload.js
const express = require('express');
const router = express.Router();
const { upload } = require('../services/fileUploadService');
const fileUploadController = require('../controllers/fileUploadController');

router.post('/', upload.single('file'), fileUploadController.uploadAndTranslate);

module.exports = router;
