// Message Worker
const logger = require('../../utils/logger');

module.exports = (queue) => {
  queue.process(async (job) => {
    const { message, queueEnqueuedAt } = job.data;
    // Calcula tempo de espera na fila
    const now = Date.now();
    let queueWaitMs = null;
    if (queueEnqueuedAt) {
      queueWaitMs = now - queueEnqueuedAt;
      logger.info({ event: 'queue_wait_time', jobId: job.id, queueWaitMs });
      // Pode salvar métricas em Redis ou alertar se passar limite
    }
    // Aqui pode integrar com IA, salvar no banco, etc.
    return { status: 'processed', message, queueWaitMs };
  });
};
