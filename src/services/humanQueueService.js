// humanQueueService.js
// Fila de espera para atendimento humano, previsão de tempo e transição de contexto

const redisConfig = require('../config/redis');
const redis = redisConfig.redis;

const HUMAN_QUEUE_KEY = 'human:queue';

async function addToHumanQueue(userId) {
  await redis.rpush(HUMAN_QUEUE_KEY, userId);
}

async function removeFromHumanQueue(userId) {
  await redis.lrem(HUMAN_QUEUE_KEY, 0, userId);
}

async function getHumanQueue() {
  return await redis.lrange(HUMAN_QUEUE_KEY, 0, -1);
}

async function getUserPosition(userId) {
  const queue = await getHumanQueue();
  const pos = queue.indexOf(userId);
  return pos >= 0 ? pos + 1 : null;
}

async function getEstimatedWaitTime(userId, avgHandleTimeMin = 3) {
  const pos = await getUserPosition(userId);
  if (pos === null) return null;
  return pos * avgHandleTimeMin;
}

module.exports = {
  addToHumanQueue,
  removeFromHumanQueue,
  getHumanQueue,
  getUserPosition,
  getEstimatedWaitTime
};
