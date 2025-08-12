// feedbackRoutes.js
// API para feedback do usuário sobre respostas de IA

const express = require('express');
const router = express.Router();
const { addUserFeedback } = require('../services/contextManager');

router.post('/feedback', async (req, res) => {
  try {
    const { userId, feedback, messageId } = req.body;
    if (!userId || !feedback) return res.status(400).json({ error: 'userId e feedback são obrigatórios.' });
    await addUserFeedback(userId, { feedback, messageId });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
