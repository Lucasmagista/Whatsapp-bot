// src/controllers/contextTransferController.js
// Controller para transferência de contexto/histórico

const contextTransferService = require('../services/contextTransferService');

const contextTransferController = {
  getContext: async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
    const context = await contextTransferService.getContextForUser(userId);
    res.json(context);
  },
  transfer: async (req, res) => {
    const { userId, operatorId } = req.body;
    if (!userId || !operatorId) return res.status(400).json({ error: 'userId e operatorId obrigatórios' });
    await contextTransferService.transferToHuman(userId, operatorId);
    res.json({ transferred: true });
  }
};

module.exports = contextTransferController;
