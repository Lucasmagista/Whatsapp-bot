// topicRoutes.js
// Endpoint para análise de tópicos e tendências

const express = require('express');
const router = express.Router();
const { getTrendingTopics } = require('../services/topicAnalysisService');

router.get('/analytics/topics', async (req, res) => {
  try {
    const topics = await getTrendingTopics();
    res.status(200).json(topics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
