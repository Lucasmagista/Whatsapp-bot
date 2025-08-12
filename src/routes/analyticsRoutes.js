// analyticsRoutes.js
// Endpoints para relatórios de uso e insights

const express = require('express');
const router = express.Router();
const { getIntentStats, getSentimentStats } = require('../services/analyticsService');

router.get('/analytics/intents', async (req, res) => {
  try {
    const stats = await getIntentStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/sentiments', async (req, res) => {
  try {
    const stats = await getSentimentStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
