const { logProviderMetric, getProviderStats } = require('./providerMonitorService');
const { sendUrgencyAlert } = require('./alertService');
const { detectUrgency } = require('./urgencyService');
// nlpOrchestrator.js
// Módulo centralizado de NLP para detecção de intenção, sentimento, entidades e resposta automática

const { Configuration, OpenAIApi } = require('openai');
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');
const redisConfig = require('../config/redis');
const redis = redisConfig.redis;

const PROVIDERS = ['openai', 'huggingface', 'google', 'azure'];

async function detectIntent(text, context, providers) {
  for (const provider of providers) {
    const start = Date.now();
    try {
      if (provider === 'openai') {
        const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
        const openai = new OpenAIApi(configuration);
        const completion = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'Classifique a intenção da mensagem do usuário. Responda apenas com a intenção (ex: order, catalog, support, cancel, payment, general_question).' },
            { role: 'user', content: text }
          ]
        });
        const latency = Date.now() - start;
        await logProviderMetric(provider, 'latency', latency);
        return completion.data.choices[0].message.content.trim();
      }
      if (provider === 'huggingface') {
        const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-mnli', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: text })
        });
        const latency = Date.now() - start;
        await logProviderMetric(provider, 'latency', latency);
        const data = await response.json();
        if (data && data.labels) return data.labels[0];
      }
      // Google e Azure: implementar conforme APIs específicas
    } catch (err) {
      const latency = Date.now() - start;
      await logProviderMetric(provider, 'latency', latency);
      await logProviderMetric(provider, 'error', 1);
      logger.warn({ event: 'intent_detection_error', provider, error: err });
      Sentry.captureException(err);
    }
  }
  return 'general_question';
}

async function analyzeSentiment(text, context, providers) {
  for (const provider of providers) {
    try {
      if (provider === 'openai') {
        const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
        const openai = new OpenAIApi(configuration);
        const completion = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'Classifique o sentimento da mensagem do usuário como positivo, negativo ou neutro.' },
            { role: 'user', content: text }
          ]
        });
        return completion.data.choices[0].message.content.trim();
      }
      if (provider === 'huggingface') {
        const response = await fetch('https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: text })
        });
        const data = await response.json();
        if (data && data[0] && data[0].label) return data[0].label;
      }
      // Google e Azure: implementar conforme APIs específicas
    } catch (err) {
      logger.warn({ event: 'sentiment_analysis_error', provider, error: err });
      Sentry.captureException(err);
    }
  }
  return 'neutro';
}

async function extractEntities(text, context, providers) {
  for (const provider of providers) {
    try {
      if (provider === 'openai') {
        const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
        const openai = new OpenAIApi(configuration);
        const completion = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'Extraia entidades relevantes da mensagem do usuário (ex: nome, endereço, número do pedido, produto, valor, etc.) e retorne em JSON.' },
            { role: 'user', content: text }
          ]
        });
        try {
          return JSON.parse(completion.data.choices[0].message.content);
        } catch {
          return { raw: completion.data.choices[0].message.content };
        }
      }
      if (provider === 'huggingface') {
        // Exemplo com modelo NER público
        const response = await fetch('https://api-inference.huggingface.co/models/dbmdz/bert-large-cased-finetuned-conll03-english', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: text })
        });
        const data = await response.json();
        return data;
      }
      // Google e Azure: implementar conforme APIs específicas
    } catch (err) {
      logger.warn({ event: 'entity_extraction_error', provider, error: err });
      Sentry.captureException(err);
    }
  }
  return {};
}

async function generateResponse(text, context, providers) {
  // Suporte ao tom de resposta: 'quick' (rápida), 'detailed' (detalhada), 'default'
  const tone = context.tone || context?.userProfile?.tone || 'default';
  let systemPrompt = 'Responda de forma clara, objetiva e profissional.';
  if (tone === 'quick') systemPrompt = 'Responda de forma muito breve, apenas o essencial.';
  if (tone === 'detailed') systemPrompt = 'Responda de forma detalhada, explicando cada ponto com exemplos se possível.';
  // Adaptação conforme perfil do usuário
  if (context?.userProfile?.preferFormal) systemPrompt += ' Use linguagem formal.';
  if (context?.userProfile?.preferFriendly) systemPrompt += ' Use linguagem amigável e descontraída.';
  for (const provider of providers) {
    try {
      if (provider === 'openai') {
        const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
        const openai = new OpenAIApi(configuration);
        const completion = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ]
        });
        return completion.data.choices[0].message.content.trim();
      }
      if (provider === 'huggingface') {
        const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: text })
        });
        const data = await response.json();
        if (data && data[0] && data[0].generated_text) return data[0].generated_text;
      }
      // Google e Azure: implementar conforme APIs específicas
    } catch (err) {
      logger.warn({ event: 'response_generation_error', provider, error: err });
      Sentry.captureException(err);
    }
  }
  return 'Desculpe, não consegui entender sua solicitação.';
}


const {
  getUserContext,
  updateUserContext,
  addMessageToHistory,
  detectLanguage,
  translateText,
  addUserFeedback
} = require('./contextManager');

async function processNLP(text, context = {}) {
  const userId = context.phoneNumber || context.userId || 'anon';
  // Histórico multi-turno
  await addMessageToHistory(userId, text, 'user');
  const userContext = await getUserContext(userId);
  const { getProviderConfig } = require('./providerConfigService');
    // Lê provedores dinamicamente
    const providers = await getProviderConfig();
    const detectedLang = await detectLanguage(text);
    if (userContext.language !== detectedLang) {
      await updateUserContext(userId, { language: detectedLang });
    }
    // Tradução para português se necessário
    let processedText = text;
    if (detectedLang !== 'pt') {
      processedText = await translateText(text, 'pt');
    }
  const cacheKey = `nlp:${processedText}`;
  let cached = null;
  if (process.env.INTENT_CACHE_ENABLED === 'true') {
    cached = await redis.get(cacheKey);
    if (cached) {
      logger.info({ event: 'nlp_cache_hit', text: processedText, cached });
      Sentry.captureMessage('NLP cache hit');
      return JSON.parse(cached);
    }
  }
  // Passa histórico para IA
  const intent = await detectIntent(processedText, { ...context, history: userContext.history }, providers);
  const sentiment = await analyzeSentiment(processedText, { ...context, history: userContext.history }, providers);
  const entities = await extractEntities(processedText, { ...context, history: userContext.history }, providers);
  const response = await generateResponse(processedText, { ...context, history: userContext.history }, providers);
  // Tradução de volta se necessário
  let finalResponse = response;
  if (detectedLang !== 'pt') {
    finalResponse = await translateText(response, detectedLang);
  }
  // Atualiza histórico
  await addMessageToHistory(userId, finalResponse, 'bot');
  // Detecção de urgência
  const isUrgent = detectUrgency(processedText, sentiment);
  const result = { intent, sentiment, entities, response: finalResponse, language: detectedLang, history: userContext.history, urgent: isUrgent };
  logger.info({ event: 'nlp_result', userId, text, result });
  if (isUrgent) {
    logger.warn({ event: 'urgent_message_detected', userId, text, result });
    Sentry.captureMessage('Mensagem urgente detectada!');
    // Envia alerta para equipe
    sendUrgencyAlert(userId, processedText, result);
  } else {
    Sentry.captureMessage('NLP result');
  }
  if (process.env.INTENT_CACHE_ENABLED === 'true') {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', process.env.INTENT_CACHE_TTL || 600);
    logger.info({ event: 'nlp_cache_set', cacheKey });
    Sentry.captureMessage('NLP cache set');
  }
  return result;
}

module.exports = { processNLP };
