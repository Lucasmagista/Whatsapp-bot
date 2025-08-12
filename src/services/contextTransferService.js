// src/services/contextTransferService.js
// Serviço para transferência de contexto/histórico do bot para humano

const ConversationState = require('../models/ConversationState');
const User = require('../models/User');

const contextTransferService = {
  async getContextForUser(userId) {
    // Buscar contexto e histórico do usuário
    const state = await ConversationState.findByUserId(userId);
    const user = await User.findById(userId);
    return { user, state };
  },
  async transferToHuman(userId, operatorId) {
    // Marcar usuário como em atendimento humano e transferir contexto
    // (Implementação depende do modelo de dados)
    // Exemplo:
    // await ConversationState.setHumanOperator(userId, operatorId);
    return true;
  }
};

module.exports = contextTransferService;
