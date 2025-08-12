// providerConfigRoutes.js
// Endpoints REST para configuração dinâmica dos provedores de NLP

const express = require('express');
const router = express.Router();
const { getProviderConfig, setProviderConfig } = require('../services/providerConfigService');

router.get('/nlp/providers', async (req, res) => {
  try {
    const config = await getProviderConfig();
    res.status(200).json({ providers: config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/nlp/providers', async (req, res) => {
  try {
    const { providers } = req.body;
    if (!Array.isArray(providers) || !providers.length) {
      return res.status(400).json({ error: 'providers deve ser um array não vazio.' });
    }
    await setProviderConfig(providers);
    res.status(200).json({ providers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
