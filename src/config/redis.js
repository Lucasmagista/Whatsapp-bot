// Redis configuration

const logger = require('../utils/logger');
const Redis = require('ioredis');
let redis = null;
let redisType = null;

// Configuração Upstash (Redis Cloud)
const upstashUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
const upstashPassword = process.env.UPSTASH_REDIS_PASSWORD || process.env.REDIS_PASSWORD;

logger.info(`[Redis][DEBUG] UPSTASH_REDIS_URL: ${process.env.UPSTASH_REDIS_URL}`);
logger.info(`[Redis][DEBUG] REDIS_URL: ${process.env.REDIS_URL}`);
logger.info(`[Redis][DEBUG] upstashUrl usado: ${upstashUrl}`);
logger.info(`[Redis][DEBUG] REDIS_HOST: ${process.env.REDIS_HOST}`);
logger.info(`[Redis][DEBUG] REDIS_PORT: ${process.env.REDIS_PORT}`);
logger.info(`[Redis][DEBUG] REDIS_PASSWORD: ${process.env.REDIS_PASSWORD}`);

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
  // Se houver URL de cloud, só tenta ela
  if (upstashUrl) {
    redis = await tryConnectRedis(upstashUrl, 'Upstash/Cloud');
    if (redis) {
      redisType = 'upstash';
      attachErrorHandlers(redis, 'Upstash/Cloud');
      return redis;
    } else {
      throw new Error('Não foi possível conectar ao Redis Cloud (Upstash/Redis Cloud). Verifique a URL e a conectividade.');
    }
  } else {
    // Se não houver URL de cloud, tenta local
    redis = await tryConnectRedis(localConfig, 'Local');
    if (redis) {
      redisType = 'local';
      attachErrorHandlers(redis, 'Local');
      return redis;
    }
    throw new Error('Não foi possível conectar ao Redis local. Verifique se o serviço está rodando.');
  }
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
  get redis() {
    if (!redis) {
      throw new Error('[Redis] Tentativa de acesso antes da conexão. Certifique-se de chamar e aguardar connectRedis() antes de usar redis.');
    }
    return redis;
  },
  get redisType() { return redisType; },
  connectRedis
};
