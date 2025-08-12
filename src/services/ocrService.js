// ocrService.js
// Serviço de extração de texto de imagens usando Tesseract.js

const Tesseract = require('tesseract.js');
const path = require('path');
const logger = require('../utils/logger');

async function extractTextFromImage(imagePath, lang = 'por') {
  try {
    const { data: { text } } = await Tesseract.recognize(
      path.resolve(imagePath),
      lang,
      { logger: m => logger.info({ event: 'ocr_progress', progress: m }) }
    );
    return text;
  } catch (error) {
    logger.error('Erro no OCR:', error);
    return null;
  }
}

module.exports = { extractTextFromImage };
