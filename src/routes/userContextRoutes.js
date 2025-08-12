// userContextRoutes.js
// Endpoint para consulta detalhada do histórico/contexto de um usuário

const express = require('express');
const router = express.Router();
const { getUserContext } = require('../services/contextManager');

router.get('/user/:userId/context', async (req, res) => {
  try {
    const { userId } = req.params;
    const context = await getUserContext(userId);
    res.status(200).json(context);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
