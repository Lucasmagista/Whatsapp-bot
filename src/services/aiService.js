
// AI Service escalável
const { Configuration, OpenAIApi } = require('openai');
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');
const redisConfig = require('../config/redis');
const redis = redisConfig.redis;
const sanitize = require('sanitize-html');
const requiredEnv = [
  'OPENAI_API_KEY', 'NLP_PROVIDERS', 'INTENT_CACHE_ENABLED', 'INTENT_CACHE_TTL',
  'REDIS_HOST', 'REDIS_PORT'
];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    logger.error(`Variável de ambiente obrigatória não definida: ${key}`);
    Sentry.captureMessage(`Variável de ambiente obrigatória não definida: ${key}`);
  }
});
// Suporte a múltiplos provedores
const providers = {
  openai: async (text, context) => {
    if (!process.env.OPENAI_API_KEY) return null;
    const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);
    const timeout = Number(process.env.OPENAI_TIMEOUT_MS) || 5000;
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const completion = await openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um atendente virtual.' },
          { role: 'user', content: text }
        ]
      }, { signal: controller.signal });
      clearTimeout(timer);
      Sentry.captureMessage(`Tempo de resposta OpenAI: ${Date.now() - start}ms`);
      Sentry.setTag('ai_provider', 'openai');
      return completion.data.choices[0].message.content;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  },
  // HuggingFace
  huggingface: async (text, context) => {
    if (!process.env.HF_API_URL || !process.env.HF_API_TOKEN) return null;
    const fetch = require('node-fetch');
    const timeout = Number(process.env.HF_TIMEOUT_MS) || 5000;
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(process.env.HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: text }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await response.json();
      Sentry.captureMessage(`Tempo de resposta HuggingFace: ${Date.now() - start}ms`);
      Sentry.setTag('ai_provider', 'huggingface');
      return data.generated_text || null;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  },
  // Azure
  azure: async (text, context) => {
    if (!process.env.AZURE_API_URL || !process.env.AZURE_API_KEY) return null;
    const fetch = require('node-fetch');
    const timeout = Number(process.env.AZURE_TIMEOUT_MS) || 5000;
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(process.env.AZURE_API_URL, {
        method: 'POST',
        headers: {
          'api-key': process.env.AZURE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await response.json();
      Sentry.captureMessage(`Tempo de resposta Azure: ${Date.now() - start}ms`);
      Sentry.setTag('ai_provider', 'azure');
      return data.choices?.[0]?.text || null;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }
};

const getConfiguredProviders = () => {
  const config = process.env.NLP_PROVIDERS || 'openai';
  return config.split(',').map(p => p.trim()).filter(p => providers[p]);
};

// Função getAIResponse descontinuada. Use o módulo centralizado nlpOrchestrator.js para NLP completo.
// module.exports = { getAIResponse };
