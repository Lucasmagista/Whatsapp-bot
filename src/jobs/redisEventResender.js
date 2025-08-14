// src/jobs/redisEventResender.js
// Job periódico para reenviar eventos não processados do Redis para a dashboard/API

const { redis } = require('../config/redis');
const axios = require('axios');

const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || 'http://localhost:3000/api/event';
const RESEND_INTERVAL_MS = 60 * 1000; // 1 minuto
const REDIS_KEY = 'pending:events';

async function resendPendingEvents() {
  try {
    const events = await redis.lrange(REDIS_KEY, 0, -1);
    for (const eventStr of events) {
      const event = JSON.parse(eventStr);
      try {
        await axios.post(DASHBOARD_API_URL, event);
        await redis.lrem(REDIS_KEY, 1, eventStr);
        console.log('Evento reenviado com sucesso:', event.id || event.type);
      } catch (err) {
        console.error('Falha ao reenviar evento:', err.message);
      }
    }
  } catch (err) {
    console.error('Erro ao buscar eventos pendentes no Redis:', err.message);
  }
}

setInterval(resendPendingEvents, RESEND_INTERVAL_MS);

module.exports = { resendPendingEvents };
