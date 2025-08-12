// personalizationRoutes.js
// Endpoints para personalização e recomendações

const express = require('express');
const router = express.Router();
const { updateUserPreferences, getUserPreferences, recommendForUser } = require('../services/contextManager');

router.post('/user/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;
    const context = await updateUserPreferences(userId, preferences);
    res.status(200).json({ preferences: context.preferences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = await getUserPreferences(userId);
    res.status(200).json({ preferences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/:userId/recommendation', async (req, res) => {
  try {
    const { userId } = req.params;
    const recommendation = await recommendForUser(userId);
    res.status(200).json(recommendation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
