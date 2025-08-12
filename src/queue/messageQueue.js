// Função para calcular tempo médio de espera na fila
async function getAverageQueueWaitTime(queueName) {
  const queue = queues[`${queueName}Queue`];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  const jobs = await queue.getCompleted(0, 99);
  const waitTimes = jobs
    .map(j => j.data && j.data.queueEnqueuedAt && j.finishedOn ? (j.finishedOn - j.data.queueEnqueuedAt) : null)
    .filter(Boolean);
  if (!waitTimes.length) return 0;
  return waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
}

// Função para alerta se tempo médio exceder limite
async function checkQueueWaitAlert(queueName, limitMs = 10000) {
  const avg = await getAverageQueueWaitTime(queueName);
  if (avg > limitMs) {
    const logger = require('../utils/logger');
    logger.warn({ event: 'queue_wait_alert', queueName, avgWaitMs: avg });
    // Aqui pode acionar alerta por e-mail, WhatsApp, etc.
    return true;
  }
  return false;
}
const Queue = require('bull');
const logger = require('../utils/logger');


const redisConfigModule = require('../config/redis');

function getBullRedisConfig() {
  // Upstash/Cloud Redis URL
  if (process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL) {
    return process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
  }
  // Local Redis config
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASS || process.env.REDIS_PASSWORD || ''
  };
}

const queues = {};

const initializeQueue = async () => {
  const bullRedisConfig = getBullRedisConfig();
  queues.messageQueue = new Queue('message-processing', {
    redis: bullRedisConfig,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }
  });
  queues.messageQueue.on('error', (err) => {
    logger.error('[Bull][message-processing] Erro na fila:', err);
  });
  queues.messageQueue.on('stalled', (job) => {
    logger.warn('[Bull][message-processing] Job parado detectado:', job.id);
  });

  queues.invoiceQueue = new Queue('invoice-generation', {
    redis: bullRedisConfig,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 25,
      attempts: 2
    }
  });
  queues.invoiceQueue.on('error', (err) => {
    logger.error('[Bull][invoice-generation] Erro na fila:', err);
  });
  queues.invoiceQueue.on('stalled', (job) => {
    logger.warn('[Bull][invoice-generation] Job parado detectado:', job.id);
  });

  queues.deliveryQueue = new Queue('delivery-notifications', {
    redis: bullRedisConfig,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 5
    }
  });
  queues.deliveryQueue.on('error', (err) => {
    logger.error('[Bull][delivery-notifications] Erro na fila:', err);
  });
  queues.deliveryQueue.on('stalled', (job) => {
    logger.warn('[Bull][delivery-notifications] Job parado detectado:', job.id);
  });

  queues.emailQueue = new Queue('email-sending', {
    redis: bullRedisConfig,
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 3
    }
  });
  queues.emailQueue.on('error', (err) => {
    logger.error('[Bull][email-sending] Erro na fila:', err);
  });
  queues.emailQueue.on('stalled', (job) => {
    logger.warn('[Bull][email-sending] Job parado detectado:', job.id);
  });

  require('./workers/messageWorker')(queues.messageQueue);
  require('./workers/invoiceWorker')(queues.invoiceQueue);
  require('./workers/deliveryWorker')(queues.deliveryQueue);
  require('./workers/emailWorker')(queues.emailQueue);
  logger.info('All queues initialized successfully');
};


// Adiciona suporte a prioridade e métricas de tempo de fila
const addToQueue = async (queueName, data, options = {}) => {
  const queue = queues[`${queueName}Queue`];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  // Define prioridade: 1 = urgente, 2 = normal (Bull: menor número = maior prioridade)
  let priority = 2;
  if (data.urgent === true || options.urgent === true) priority = 1;
  // Marca timestamp de entrada na fila
  const jobData = { ...data, queueEnqueuedAt: Date.now() };
  return await queue.add(jobData, { ...options, priority });
};

const getQueueStatus = async (queueName) => {
  const queue = queues[`${queueName}Queue`];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount()
  ]);
  return { waiting, active, completed, failed };
};

module.exports = { initializeQueue, addToQueue, getQueueStatus, queues, getAverageQueueWaitTime, checkQueueWaitAlert };
