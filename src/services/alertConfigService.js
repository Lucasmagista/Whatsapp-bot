// alertConfigService.js
// Serviço para configuração dinâmica de regras de alerta

const redisConfig = require('../config/redis');
const redis = redisConfig.redis;

const ALERT_CONFIG_KEY = 'alert:config';

async function getAlertConfig() {
  const config = await redis.get(ALERT_CONFIG_KEY);
  if (config) return JSON.parse(config);
  // Valores padrão
  return {
    queueWaitLimitMs: 10000,
    providerErrorRateLimit: 0.2,
    criticalKeywords: ['urgente', 'reclamação', 'erro', 'procon', 'processo', 'cancelamento']
  };
}

async function setAlertConfig(newConfig) {
  await redis.set(ALERT_CONFIG_KEY, JSON.stringify(newConfig));
  return newConfig;
}

module.exports = { getAlertConfig, setAlertConfig };
