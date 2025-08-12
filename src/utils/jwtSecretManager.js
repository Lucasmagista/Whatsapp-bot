// src/utils/jwtSecretManager.js
const crypto = require('crypto');
const { redis, connectRedis } = require('../config/redis');
const SECRET_KEY = 'jwt:secret';
const SECRET_EXP_KEY = 'jwt:secret:exp';
let currentSecret = null;
let expiresAt = null;
let expiresInMs = parseJwtExpiresIn(process.env.JWT_EXPIRES_IN || '1d');
let rotating = false;

function generateSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function parseJwtExpiresIn(str) {
  // Suporta '1d', '12h', '30m', '60s'
  const match = /^(\d+)([dhms])$/.exec(str);
  if (!match) return 24 * 60 * 60 * 1000; // padrão: 1 dia
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    case 's': return value * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

async function loadSecretFromRedis() {
  if (!redis) return false;
  const secret = await redis.get(SECRET_KEY);
  const exp = await redis.get(SECRET_EXP_KEY);
  if (secret && exp) {
    currentSecret = secret;
    expiresAt = parseInt(exp, 10);
    return true;
  }
  return false;
}

async function saveSecretToRedis(secret, exp) {
  if (!redis) return;
  await redis.set(SECRET_KEY, secret);
  await redis.set(SECRET_EXP_KEY, exp.toString());
}

async function rotateSecret() {
  if (rotating) return;
  rotating = true;
  try {
    const secret = generateSecret();
    const exp = Date.now() + expiresInMs;
    currentSecret = secret;
    expiresAt = exp;
    await saveSecretToRedis(secret, exp);
    setTimeout(rotateSecret, expiresInMs);
  } finally {
    rotating = false;
  }
}

async function initSecretManager() {
  if (!redis) await connectRedis();
  const loaded = await loadSecretFromRedis();
  if (!loaded || Date.now() > expiresAt) {
    await rotateSecret();
  } else {
    setTimeout(rotateSecret, expiresAt - Date.now());
  }
}

function getSecret() {
  if (!currentSecret) throw new Error('JWT secret não inicializado!');
  return currentSecret;
}

// Inicializa ao importar
initSecretManager();

module.exports = {
  getSecret,
  initSecretManager,
};
