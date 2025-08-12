// src/controllers/fileUploadController.js
// Controller para upload, extração e tradução de arquivos de texto

const { extractText, translateText } = require('../services/fileUploadService');

const fileUploadController = {
  uploadAndTranslate: async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Arquivo não enviado' });
      const text = await extractText(file.path, file.mimetype);
      const translated = await translateText(text, req.body.lang || 'en');
      res.json({ text, translated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = fileUploadController;
