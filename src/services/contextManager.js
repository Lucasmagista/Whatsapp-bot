// Personalização avançada: preferências e recomendações
async function updateUserPreferences(userId, preferences) {
  const context = await getUserContext(userId);
  context.preferences = { ...context.preferences, ...preferences };
  await getRedis().set(`context:${userId}`, JSON.stringify(context), 'EX', 86400);
  return context;
}

async function getUserPreferences(userId) {
  const context = await getUserContext(userId);
  return context.preferences || {};
}

async function recommendForUser(userId) {
  const context = await getUserContext(userId);
  // Exemplo simples: recomenda produto mais citado no histórico
  const productCounts = {};
  if (context.history) {
    context.history.forEach(msg => {
      if (msg.entities && msg.entities.produto) {
        const prod = msg.entities.produto;
        productCounts[prod] = (productCounts[prod] || 0) + 1;
      }
    });
  }
  const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return topProduct ? { recommendation: `Recomendamos o produto: ${topProduct}` } : { recommendation: null };
}
// contextManager.js
// Gerencia contexto multi-turno, histórico, idioma e feedback do usuário

const redisConfig = require('../config/redis');
function getRedis() { return redisConfig.redis || global.__REDIS_MOCK__; }
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');
const { Configuration, OpenAIApi } = require('openai');
const fetch = require('node-fetch');

async function getUserContext(userId) {
  const data = await getRedis().get(`context:${userId}`);
  return data ? JSON.parse(data) : { history: [], language: 'pt', feedback: [] };
}

async function updateUserContext(userId, update) {
  const context = await getUserContext(userId);
  const newContext = { ...context, ...update };
  await getRedis().set(`context:${userId}`, JSON.stringify(newContext), 'EX', 86400);
  return newContext;
}

async function addMessageToHistory(userId, message, role = 'user') {
  const context = await getUserContext(userId);
  context.history.push({ role, message, timestamp: new Date().toISOString() });
  if (context.history.length > 20) context.history.shift();
  await getRedis().set(`context:${userId}`, JSON.stringify(context), 'EX', 86400);
  return context;
}

async function detectLanguage(text) {
  // OpenAI prompt para detecção de idioma
  try {
    const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Detecte o idioma da mensagem do usuário. Responda apenas com o código ISO 639-1 (ex: pt, en, es, fr).' },
        { role: 'user', content: text }
      ]
    });
    return completion.data.choices[0].message.content.trim();
  } catch (err) {
    logger.warn({ event: 'language_detection_error', error: err });
    Sentry.captureException(err);
    return 'pt';
  }
}

async function translateText(text, targetLang) {
  // Exemplo usando HuggingFace MarianMT
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-mul-en', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: text })
    });
    const data = await response.json();
    if (data && data[0] && data[0].translation_text) return data[0].translation_text;
    return text;
  } catch (err) {
    logger.warn({ event: 'translation_error', error: err });
    Sentry.captureException(err);
    return text;
  }
}

async function addUserFeedback(userId, feedback) {
  const context = await getUserContext(userId);
  context.feedback.push({ ...feedback, timestamp: new Date().toISOString() });
  await getRedis().set(`context:${userId}`, JSON.stringify(context), 'EX', 86400);
  return context;
}

module.exports = {
  getUserContext,
  updateUserContext,
  addMessageToHistory,
  detectLanguage,
  translateText,
  addUserFeedback
  ,updateUserPreferences
  ,getUserPreferences
  ,recommendForUser
};