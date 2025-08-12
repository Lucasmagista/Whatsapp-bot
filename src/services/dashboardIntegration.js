// src/services/dashboardIntegration.js
// Serviço de integração entre o bot WhatsApp e a dashboard admin

const axios = require('axios');
const logger = require('../utils/logger');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const DEFAULT_TIMEOUT = Number(process.env.DASHBOARD_TIMEOUT) || 5000;
const DEFAULT_RETRIES = Number(process.env.DASHBOARD_RETRIES) || 3;
const MAX_BATCH_SIZE = 50;
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

// Função auxiliar para obter headers de autenticação (token JWT, API Key, etc)
function getAuthHeaders() {
  const token = process.env.DASHBOARD_TOKEN;
  const apiKey = process.env.DASHBOARD_API_KEY;
  let headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  return headers;
}

// Validação básica dos dados do evento
function validateEvent(event, payload) {
  if (typeof event !== 'string' || !event.trim()) {
    throw new Error('Evento deve ser uma string não vazia');
  }
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Payload deve ser um objeto');
  }
  const payloadSize = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    throw new Error('Payload excede tamanho máximo permitido');
  }
}

// Fallback: salva evento no Redis se dashboard estiver offline
async function saveEventToLocalQueue(event, payload) {
  try {
    await redis.lpush('dashboard:events', JSON.stringify({ event, payload, timestamp: new Date().toISOString() }));
    logger.warn(`[DASHBOARD] Evento salvo localmente no Redis: ${event}`);
  } catch (err) {
    logger.error('[DASHBOARD] Falha ao salvar evento localmente', err.message);
  }
}

/**
 * Envia dados de eventos do bot para a dashboard via API REST
 * @param {string} event Tipo de evento (ex: 'new_message', 'order_update', 'user_login')
 * @param {object} payload Dados do evento
 * @returns {Promise<void>}
 */
async function sendEventToDashboard(event, payload, options = {}) {
  validateEvent(event, payload);
  const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001/api/bot-events';
  const headers = { ...getAuthHeaders(), ...options.headers };
  const body = {
    event,
    payload,
    timestamp: new Date().toISOString(),
    ...options.extra
  };
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const maxRetries = options.retries || DEFAULT_RETRIES;
  let attempt = 0;
  const start = Date.now();
  while (attempt < maxRetries) {
    try {
      attempt++;
      logger.info(`[DASHBOARD] Tentativa ${attempt} de envio do evento: ${event}`);
      const res = await axios.post(DASHBOARD_URL, body, { headers, timeout });
      logger.info(`[DASHBOARD] Evento enviado: ${event} (${res.status}) em ${Date.now() - start}ms`);
      return res.data;
    } catch (error) {
      logger.warn(`[DASHBOARD] Falha tentativa ${attempt} (${error.message})`);
      if (attempt >= maxRetries) {
        await saveEventToLocalQueue(event, payload);
        if (error.response) {
          logger.error(`[DASHBOARD] Falha ao enviar evento: ${event} (${error.response.status})`, error.response.data);
        } else {
          logger.error(`[DASHBOARD] Falha ao enviar evento: ${event}`, error.message);
        }
        throw error;
      }
      await new Promise(res => setTimeout(res, 500 * attempt)); // backoff
    }
  }
}

/**
 * Envia múltiplos eventos em lote para a dashboard
 * @param {Array<{event:string, payload:object}>} events
 * @returns {Promise<void>}
 */
async function sendBatchEvents(events, options = {}) {
  if (!Array.isArray(events) || events.length === 0) throw new Error('Batch de eventos deve ser um array não vazio');
  if (events.length > MAX_BATCH_SIZE) throw new Error(`Batch excede o máximo de ${MAX_BATCH_SIZE} eventos`);
  events.forEach(e => validateEvent(e.event, e.payload));
  const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001/api/bot-events/batch';
  const headers = { ...getAuthHeaders(), ...options.headers };
  const body = events.map(e => ({ ...e, timestamp: new Date().toISOString() }));
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const maxRetries = options.retries || DEFAULT_RETRIES;
  let attempt = 0;
  const start = Date.now();
  while (attempt < maxRetries) {
    try {
      attempt++;
      logger.info(`[DASHBOARD] Tentativa ${attempt} de envio do batch de eventos (${events.length})`);
      const res = await axios.post(DASHBOARD_URL, body, { headers, timeout });
      logger.info(`[DASHBOARD] Batch de eventos enviado (${res.status}) em ${Date.now() - start}ms`);
      return res.data;
    } catch (error) {
      logger.warn(`[DASHBOARD] Falha tentativa batch ${attempt} (${error.message})`);
      if (attempt >= maxRetries) {
        for (const e of events) await saveEventToLocalQueue(e.event, e.payload);
        logger.error('[DASHBOARD] Falha ao enviar batch de eventos', error.message);
        throw error;
      }
      await new Promise(res => setTimeout(res, 500 * attempt));
    }
  }
}

/**
 * Consulta status do dashboard (exemplo de integração)
 * @returns {Promise<object>}
 */
async function getDashboardStatus() {
  try {
    const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001/api/status';
    const headers = getAuthHeaders();
    const res = await axios.get(DASHBOARD_URL, { headers });
    return res.data;
  } catch (error) {
    logger.error('[DASHBOARD] Falha ao consultar status', error.message);
    return { online: false, error: error.message };
  }
}

/**
 * Consulta métricas da dashboard (exemplo)
 * @returns {Promise<object>}
 */
async function getDashboardMetrics() {
  try {
    const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001/api/metrics';
    const headers = getAuthHeaders();
    const res = await axios.get(DASHBOARD_URL, { headers });
    return res.data;
  } catch (error) {
    logger.error('[DASHBOARD] Falha ao consultar métricas', error.message);
    return { metrics: null, error: error.message };
  }
}

// Futuro: integração websocket para envio em tempo real
// function emitEventToDashboardWS(io, event, payload) {
//   io.emit('dashboard-event', { event, payload, timestamp: new Date().toISOString() });
// }

module.exports = {
  sendEventToDashboard,
  getDashboardStatus,
  sendBatchEvents,
  getDashboardMetrics,
  // emitEventToDashboardWS
};
