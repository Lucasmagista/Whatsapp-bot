// src/services/alertNotificationService.js
// Serviço para envio de alertas para WhatsApp, Telegram e Slack

const { WebClient } = require('@slack/web-api');
const TelegramBot = require('node-telegram-bot-api');
// WhatsApp: usar serviço já existente do bot

// Configurações de tokens (ajustar para variáveis de ambiente em produção)
const SLACK_TOKEN = process.env.SLACK_TOKEN || 'SEU_TOKEN_SLACK';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'SEU_TOKEN_TELEGRAM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'SEU_CHAT_ID';

const slackClient = new WebClient(SLACK_TOKEN);
const telegramBot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const alertNotificationService = {
  async sendSlack(message) {
    try {
      await slackClient.chat.postMessage({
        channel: '#geral', // Ajuste para o canal desejado
        text: message
      });
    } catch (err) {
      console.error('Erro ao enviar alerta para Slack:', err.message);
    }
  },
  async sendTelegram(message) {
    try {
      await telegramBot.sendMessage(TELEGRAM_CHAT_ID, message);
    } catch (err) {
      console.error('Erro ao enviar alerta para Telegram:', err.message);
    }
  },
  async sendWhatsApp(message, whatsappService) {
    try {
      // Supondo que whatsappService tenha método sendMessage
      await whatsappService.sendMessage(message);
    } catch (err) {
      console.error('Erro ao enviar alerta para WhatsApp:', err.message);
    }
  }
};

module.exports = alertNotificationService;
