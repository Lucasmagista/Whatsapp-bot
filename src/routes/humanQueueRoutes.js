// humanQueueRoutes.js
// Endpoints para fila de espera e transição para atendimento humano

const express = require('express');
const router = express.Router();
const { addToHumanQueue, removeFromHumanQueue, getUserPosition, getEstimatedWaitTime, getHumanQueue } = require('../services/humanQueueService');
const { getUserContext } = require('../services/contextManager');

// Usuário solicita atendimento humano
router.post('/human/queue', async (req, res) => {
  try {
    const { userId } = req.body;
    await addToHumanQueue(userId);
    const pos = await getUserPosition(userId);
    const eta = await getEstimatedWaitTime(userId);
    res.status(200).json({ position: pos, estimatedWaitMin: eta });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Usuário sai da fila
router.delete('/human/queue', async (req, res) => {
  try {
    const { userId } = req.body;
    await removeFromHumanQueue(userId);
    res.status(200).json({ removed: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Operador busca próximo da fila (com contexto)
router.get('/human/queue/next', async (req, res) => {
  try {
    const queue = await getHumanQueue();
    if (!queue.length) return res.status(200).json({ userId: null });
    const userId = queue[0];
    const context = await getUserContext(userId);
    res.status(200).json({ userId, context });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
