// alertConfigRoutes.js
// Endpoints REST para configuração dinâmica de regras de alerta

const express = require('express');
const router = express.Router();
const { getAlertConfig, setAlertConfig } = require('../services/alertConfigService');

router.get('/alert/config', async (req, res) => {
  try {
    const config = await getAlertConfig();
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/alert/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const config = await setAlertConfig(newConfig);
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
