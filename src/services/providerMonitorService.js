// providerMonitorService.js
// Monitoramento de latência e taxa de erro dos provedores de NLP

const redisConfig = require('../config/redis');
const redis = redisConfig.redis;

async function logProviderMetric(provider, metric, value) {
  const key = `provider:${provider}:metrics`;
  const now = Date.now();
  const entry = { metric, value, timestamp: now };
  await redis.lpush(key, JSON.stringify(entry));
  await redis.ltrim(key, 0, 99); // Mantém as 100 métricas mais recentes
}

async function getProviderMetrics(provider) {
  const key = `provider:${provider}:metrics`;
  const entries = await redis.lrange(key, 0, -1);
  return entries.map(e => JSON.parse(e));
}

async function getProviderStats(provider) {
  const metrics = await getProviderMetrics(provider);
  const latencies = metrics.filter(m => m.metric === 'latency').map(m => m.value);
  const errors = metrics.filter(m => m.metric === 'error').length;
  const total = metrics.length;
  const avgLatency = latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const errorRate = total ? (errors / total) : 0;
  return { avgLatency, errorRate, totalSamples: total };
}

module.exports = {
  logProviderMetric,
  getProviderMetrics,
  getProviderStats
};
