// src/services/dashboardWebhookService.js
const axios = require('axios');

const DASHBOARD_WEBHOOK_URL = process.env.DASHBOARD_WEBHOOK_URL || 'http://localhost:3001/dashboard-webhook';

async function sendToDashboard(event, payload) {
  try {
    await axios.post(DASHBOARD_WEBHOOK_URL, { event, payload });
  } catch (error) {
    // Não lança erro para não quebrar o fluxo do bot
    console.error('Erro ao enviar para dashboard:', error.message);
  }
}

module.exports = { sendToDashboard };
