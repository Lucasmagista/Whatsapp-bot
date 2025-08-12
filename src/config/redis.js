// Redis configuration

const logger = require('../utils/logger');
const Redis = require('ioredis');
let redis = null;
let redisType = null;

// Configuração Upstash (Redis Cloud)
const upstashUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
const upstashPassword = process.env.UPSTASH_REDIS_PASSWORD || process.env.REDIS_PASSWORD;

// Configuração Redis Local
const localConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASS || process.env.REDIS_PASSWORD || '',
};

async function tryConnectRedis(options, name) {
  try {
    const client = new Redis(options);
    await client.ping();
    logger.info(`[Redis] Conectado com sucesso via ${name}`);
    return client;
  } catch (err) {
    logger.error(`[Redis] Falha ao conectar via ${name}:`, err.message);
    return null;
  }
}

async function connectRedis() {
  // Tenta Upstash/Cloud
  if (upstashUrl) {
    redis = await tryConnectRedis(upstashUrl, 'Upstash/Cloud');
    if (redis) {
      redisType = 'upstash';
      attachErrorHandlers(redis, 'Upstash/Cloud');
      return redis;
    }
  }
  // Tenta Local
  redis = await tryConnectRedis(localConfig, 'Local');
  if (redis) {
    redisType = 'local';
    attachErrorHandlers(redis, 'Local');
    return redis;
  }
  throw new Error('Não foi possível conectar a nenhum Redis (Upstash nem Local)');
}

function attachErrorHandlers(client, name) {
  client.on('error', (err) => {
    logger.error(`[Redis][${name}] Erro:`, err.message);
  });
  client.on('end', () => {
    logger.warn(`[Redis][${name}] Conexão encerrada. Tentando reconectar...`);
  });
  client.on('reconnecting', () => {
    logger.info(`[Redis][${name}] Tentando reconectar...`);
  });
}

module.exports = {
  get redis() { return redis; },
  get redisType() { return redisType; },
  connectRedis
};
