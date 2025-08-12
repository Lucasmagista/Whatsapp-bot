// src/controllers/dashboardWebhookController.js
const receiveFromBot = async (req, res) => {
  try {
    // Aqui você pode processar e armazenar o payload recebido do bot
    // Exemplo: salvar no banco, enviar para dashboard via websocket, etc.
    res.status(200).json({ status: 'recebido', data: req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { receiveFromBot };
