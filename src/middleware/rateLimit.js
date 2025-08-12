
// Rate Limit Middleware Avançado
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisConfig = require('../config/redis');
const redis = redisConfig.redis;

const logger = require('../utils/logger');
const Sentry = require('@sentry/node');


const suspiciousAttempts = {};
const blockedIps = {};
const BLOCK_TIME_MS = 30 * 60 * 1000; // 30 minutos de bloqueio



// Configurações de limites por tipo de requisição
const limitsByType = {
  auth: { windowMs: 10 * 60 * 1000, max: 20 }, // autenticação
  message: { windowMs: 5 * 60 * 1000, max: 50 }, // envio de mensagens
  default: { windowMs: 15 * 60 * 1000, max: 100 }
};

function getLimitType(req) {
  if (req.originalUrl.includes('/login') || req.originalUrl.includes('/auth')) return 'auth';
  if (req.originalUrl.includes('/message')) return 'message';
  return 'default';
}

const limiter = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const type = getLimitType(req);
  const { windowMs, max } = limitsByType[type] || limitsByType.default;

  // Verifica se IP está bloqueado
  if (blockedIps[ip] && blockedIps[ip] > now) {
    logger.warn({ event: 'ip_blocked', ip, path: req.originalUrl, type, timestamp: new Date().toISOString() });
    Sentry.captureMessage(`IP bloqueado: ${ip} (${type})`);
    return res.status(429).json({ error: 'IP temporariamente bloqueado devido a comportamento suspeito.' });
  }

  // Inicializa tentativas se necessário
  if (!suspiciousAttempts[ip]) suspiciousAttempts[ip] = {};
  if (!suspiciousAttempts[ip][type]) suspiciousAttempts[ip][type] = { count: 0, firstAttempt: now };
  const attempt = suspiciousAttempts[ip][type];

  // Reseta contador se janela expirou
  if (now - attempt.firstAttempt > windowMs) {
    attempt.count = 0;
    attempt.firstAttempt = now;
  }
  attempt.count++;

  // Log e alerta Sentry para cada tentativa
  logger.info({ event: 'rate_limit_check', ip, path: req.originalUrl, type, count: attempt.count, timestamp: new Date().toISOString() });
  if (attempt.count > max) {
    logger.warn({ event: 'rate_limit_exceeded', ip, path: req.originalUrl, type, count: attempt.count, timestamp: new Date().toISOString() });
    Sentry.captureMessage(`Rate limit excedido: ${ip} (${type}) - Tentativas: ${attempt.count}`);
    // Bloqueia IP se exceder tentativas suspeitas
    if (attempt.count > max * 5) {
      blockedIps[ip] = now + BLOCK_TIME_MS;
      logger.error({ event: 'ip_blocked', ip, reason: 'Muitas tentativas suspeitas', type, timestamp: new Date().toISOString() });
      Sentry.captureException(new Error(`IP bloqueado por excesso de tentativas: ${ip} (${type})`));
      return res.status(429).json({ error: 'IP bloqueado por excesso de tentativas suspeitas.' });
    }
    return res.status(429).json({ error: 'Muitas requisições deste IP, tente novamente mais tarde.', attempts: attempt.count });
  }
  next();
};

module.exports = limiter;
