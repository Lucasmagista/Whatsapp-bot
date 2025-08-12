// src/controllers/humanQueueController.js
// Controller para fila de espera de atendimento humano

const HumanQueueService = require('../services/humanQueueService');

const humanQueueController = {
  join: async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
    await HumanQueueService.addToHumanQueue(userId);
    res.json({ position: await HumanQueueService.getUserPosition(userId), estimatedTime: await HumanQueueService.getEstimatedWaitTime(userId) });
  },
  leave: async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
    await HumanQueueService.removeFromHumanQueue(userId);
    res.json({ left: true });
  },
  position: async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
    res.json({ position: await HumanQueueService.getUserPosition(userId), estimatedTime: await HumanQueueService.getEstimatedWaitTime(userId) });
  },
  queue: async (req, res) => {
    res.json({ queue: await HumanQueueService.getHumanQueue() });
  }
};

module.exports = humanQueueController;
