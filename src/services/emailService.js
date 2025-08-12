// Email Service
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text
    });
    return true;
  } catch (error) {
  const Sentry = require('@sentry/node');
  logger.error('Erro ao enviar e-mail:', error);
  Sentry.captureException(error);
  return false;
  }
};

module.exports = { sendEmail };
