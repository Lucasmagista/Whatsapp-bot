// uploadRoutes.js
// Endpoint para upload de imagens/documentos e extração de texto via OCR

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractTextFromImage } = require('../services/ocrService');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

router.post('/upload/image', upload.single('file'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const lang = req.body.lang || 'por';
    const text = await extractTextFromImage(filePath, lang);
    // Remove arquivo após processamento
    fs.unlinkSync(filePath);
    res.status(200).json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
