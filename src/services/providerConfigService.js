// providerConfigService.js
// Configuração dinâmica dos provedores de NLP via Redis

const redisConfig = require('../config/redis');
const redis = redisConfig.redis;

const PROVIDER_KEY = 'nlp:providers:config';

async function getProviderConfig() {
  const config = await redis.get(PROVIDER_KEY);
  if (config) return JSON.parse(config);
  // fallback para env padrão
  return (process.env.NLP_PROVIDER_PRIORITY || 'openai,huggingface,google,azure').split(',').map(p => p.trim().toLowerCase());
}

async function setProviderConfig(providers) {
  await redis.set(PROVIDER_KEY, JSON.stringify(providers));
  return providers;
}

module.exports = { getProviderConfig, setProviderConfig };
