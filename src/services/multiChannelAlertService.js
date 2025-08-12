// multiChannelAlertService.js
// Envio de alertas automáticos para WhatsApp, Telegram e Slack

const axios = require('axios');
const logger = require('../utils/logger');

// WhatsApp (usando API externa ou serviço próprio)
async function sendWhatsAppAlert(to, message) {
  try {
    // Exemplo: integração com API externa
    if (!process.env.WHATSAPP_ALERT_API_URL) return;
    await axios.post(process.env.WHATSAPP_ALERT_API_URL, { to, message });
    logger.info({ event: 'alert_whatsapp_sent', to });
  } catch (err) {
    logger.error({ event: 'alert_whatsapp_error', error: err });
  }
}

// Telegram (usando Bot API)
async function sendTelegramAlert(chatId, message) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ALERT_CHAT_ID) return;
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text: message });
    logger.info({ event: 'alert_telegram_sent', chatId });
  } catch (err) {
    logger.error({ event: 'alert_telegram_error', error: err });
  }
}

// Slack (Webhook)
async function sendSlackAlert(message) {
  try {
    if (!process.env.SLACK_WEBHOOK_URL) return;
    await axios.post(process.env.SLACK_WEBHOOK_URL, { text: message });
    logger.info({ event: 'alert_slack_sent' });
  } catch (err) {
    logger.error({ event: 'alert_slack_error', error: err });
  }
}

module.exports = { sendWhatsAppAlert, sendTelegramAlert, sendSlackAlert };
