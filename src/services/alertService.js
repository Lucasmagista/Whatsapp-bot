// alertService.js
// Monitoramento e alertas inteligentes para equipe

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { sendWhatsAppAlert, sendTelegramAlert, sendSlackAlert } = require('./multiChannelAlertService');

const ALERT_EMAIL = process.env.ALERT_EMAIL || '';
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || 'bot@empresa.com';
const ALERT_EMAIL_PASS = process.env.ALERT_EMAIL_PASS || '';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: ALERT_EMAIL_FROM,
    pass: ALERT_EMAIL_PASS
  }
});

async function sendUrgencyAlert(userId, message, context) {
  const alertMsg = `Usuário: ${userId}\nMensagem: ${message}\nContexto: ${JSON.stringify(context, null, 2)}`;
  // E-mail
  if (ALERT_EMAIL) {
    const mailOptions = {
      from: ALERT_EMAIL_FROM,
      to: ALERT_EMAIL,
      subject: 'Alerta de Mensagem Urgente no WhatsApp Bot',
      text: alertMsg
    };
    try {
      await transporter.sendMail(mailOptions);
      logger.info({ event: 'alert_email_sent', userId });
    } catch (err) {
      logger.error({ event: 'alert_email_error', error: err });
    }
  }
  // WhatsApp
  if (process.env.WHATSAPP_ALERT_TO) {
    await sendWhatsAppAlert(process.env.WHATSAPP_ALERT_TO, alertMsg);
  }
  // Telegram
  if (process.env.TELEGRAM_ALERT_CHAT_ID) {
    await sendTelegramAlert(process.env.TELEGRAM_ALERT_CHAT_ID, alertMsg);
  }
  // Slack
  if (process.env.SLACK_WEBHOOK_URL) {
    await sendSlackAlert(alertMsg);
  }
}

module.exports = { sendUrgencyAlert };
