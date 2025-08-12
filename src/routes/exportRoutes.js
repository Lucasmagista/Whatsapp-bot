// exportRoutes.js
// Endpoint para exportação de dados de NLP para ajuste de modelos

const express = require('express');
const router = express.Router();
const { exportUserContextsToJSON } = require('../services/exportDataService');

router.get('/export/nlp-data', async (req, res) => {
  try {
    const filePath = await exportUserContextsToJSON();
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
