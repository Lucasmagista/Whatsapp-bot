// analyticsService.js
// Geração de relatórios e insights automáticos

const redisConfig = require('../config/redis');
const redis = redisConfig.redis;
const logger = require('../utils/logger');

async function getIntentStats() {
  // Exemplo: sumariza intenções salvas no contexto
  // (Ideal: usar banco ou ferramenta de BI para produção)
  const keys = await redis.keys('context:*');
  const stats = {};
  for (const key of keys) {
    const ctx = JSON.parse(await redis.get(key));
    if (ctx.history) {
      ctx.history.forEach(msg => {
        if (msg.intent) {
          stats[msg.intent] = (stats[msg.intent] || 0) + 1;
        }
      });
    }
  }
  return stats;
}

async function getSentimentStats() {
  const keys = await redis.keys('context:*');
  const stats = {};
  for (const key of keys) {
    const ctx = JSON.parse(await redis.get(key));
    if (ctx.history) {
      ctx.history.forEach(msg => {
        if (msg.sentiment) {
          stats[msg.sentiment] = (stats[msg.sentiment] || 0) + 1;
        }
      });
    }
  }
  return stats;
}

module.exports = {
  getIntentStats,
  getSentimentStats
};
