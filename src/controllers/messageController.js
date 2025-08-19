
const { sendText } = require('../services/whatsappService');
const { addToQueue } = require('../queue/messageQueue');
const { processNLP } = require('../services/nlpOrchestrator');
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');
const { sendToDashboard } = require('../services/dashboardWebhookService');
const { sendEmail } = require('../services/emailService');
const { sendSMS } = require('../services/smsService');
const { validateAndSanitizeMessage } = require('../middleware/validateMessage');

// ...existing code...

// Adiciona validação e sanitização ao envio de mensagem
const send = [
  ...validateAndSanitizeMessage,
  async (req, res) => {
    try {
      const { to, message, options, email, sms } = req.body;
  await addToQueue('message', { to, message, options });
  logger.info({ event: 'add_to_queue', to, user: req.user?.id, timestamp: new Date().toISOString() });
  await sendText(to, message, options);
  logger.info({ event: 'send_message', to, user: req.user?.id, timestamp: new Date().toISOString() });
  // Envia para dashboard
  sendToDashboard('send_message', { to, message, options, user: req.user?.id, timestamp: new Date().toISOString() });
      if (email) {
        await sendEmail(email, 'Nova mensagem do WhatsApp Bot', message);
        logger.info({ event: 'send_email', email, user: req.user?.id, timestamp: new Date().toISOString() });
      }
      if (sms) {
        await sendSMS(sms, message);
        logger.info({ event: 'send_sms', sms, user: req.user?.id, timestamp: new Date().toISOString() });
      }
      res.status(200).json({ success: true, message: 'Mensagem enviada.' });
    } catch (error) {
      logger.error({ event: 'send_message_error', error, user: req.user?.id, timestamp: new Date().toISOString() });
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  }
];

const receive = async (req, res) => {
  try {
    const { from, body } = req.body;
    // Feedback imediato ao usuário
    res.status(202).json({ status: 'processing', message: 'Sua mensagem está sendo analisada pela IA. Aguarde a resposta.' });
    // Processamento assíncrono (pode ser adaptado para fila se necessário)
    const nlpResult = await processNLP(body, { phoneNumber: from });
    logger.info({ event: 'nlp_response', from, user: req.user?.id, nlpResult, timestamp: new Date().toISOString() });
    // Envia para dashboard
    sendToDashboard('receive_message', { from, body, nlpResult, user: req.user?.id, timestamp: new Date().toISOString() });
    // Aqui pode-se enviar a resposta ao usuário por outro canal (ex: WhatsApp, WebSocket, etc.)
  } catch (error) {
    logger.error({ event: 'receive_message_error', error, user: req.user?.id, timestamp: new Date().toISOString() });
    Sentry.captureException(error);
    // Não retorna erro ao usuário final, pois já recebeu status 202
  }
};

const history = async (req, res) => {
  try {
    res.status(200).json({ history: [] });
  } catch (error) {
    logger.error('Erro ao buscar histórico:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
};

const webhook = async (req, res) => {
  try {
    res.status(200).json({ status: 'webhook recebido', event: req.body });
  } catch (error) {
    logger.error('Erro no webhook:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  send,
  receive,
  history,
  webhook
};
