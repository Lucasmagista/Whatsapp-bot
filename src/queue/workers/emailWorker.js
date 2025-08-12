// Email Worker
const { sendEmail } = require('../../services/emailService');
const logger = require('../../utils/logger');

module.exports = (queue) => {
  queue.process(async (job) => {
    const { to, subject, body } = job.data;
    try {
      await sendEmail(to, subject, body);
      return { status: 'email sent', to, subject };
    } catch (error) {
      logger.error('Erro ao enviar email no worker:', error);
      return { status: 'error', error: error.message };
    }
  });
};
