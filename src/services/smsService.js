// SMS Service (Twilio)
const logger = require('../utils/logger');

const sendSMS = async (to, body) => {
  try {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN || !process.env.TWILIO_PHONE) {
      throw new Error('Twilio não configurado');
    }
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE,
      to
    });
    return true;
  } catch (error) {
  const Sentry = require('@sentry/node');
  logger.error('Erro ao enviar SMS:', error);
  Sentry.captureException(error);
  return false;
  }
};

module.exports = { sendSMS };
