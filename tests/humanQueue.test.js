// tests/humanQueue.test.js
// Testes automatizados para fila de atendimento humano

const request = require('supertest');
const express = require('express');

// Mock simples de Redis em memória
const queue = [];
const redisMock = {
  rpush: async (key, userId) => { if (!queue.includes(userId)) queue.push(userId); },
  lrem: async (key, _count, userId) => { const idx = queue.indexOf(userId); if (idx !== -1) queue.splice(idx, 1); },
  lrange: async (key, _start, _end) => [...queue],
};
jest.mock('../src/config/redis', () => ({ redis: redisMock }));
const humanQueueRoutes = require('../src/routes/humanQueue');


const app = express();
app.use(express.json());

// Mock global para contexto compartilhado
const RedisMock = require('../__mocks__/ioredis');
global.__REDIS_MOCK__ = new RedisMock();

// Injeta o mock no app para rotas usarem o mock durante os testes
app.use((req, res, next) => {
  req.redis = global.__REDIS_MOCK__;
  next();
});

app.use('/human-queue', humanQueueRoutes);

// Preenche contexto do usuário para simular histórico
const { getUserContext } = require('../src/services/contextManager');
beforeEach(async () => {
  const redis = global.__REDIS_MOCK__;
  // Simula contexto com histórico e feedback
  await redis.set('context:user-test-1', JSON.stringify({
    history: [
      { role: 'user', message: 'Quero falar com um atendente', timestamp: new Date().toISOString() }
    ],
    language: 'pt',
    feedback: [],
    preferences: { canal: 'whatsapp' }
  }));
  // Limpa fila
  redis.lists = {};
});

describe('Fila de Atendimento Humano', () => {
  const userId = 'user-test-1';

  it('Adiciona usuário à fila e retorna posição e ETA', async () => {
    const res = await request(app)
      .post('/human-queue/join')
      .send({ userId });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('position');
    expect(res.body).toHaveProperty('estimatedTime');
  });

  it('Remove usuário da fila', async () => {
    const res = await request(app)
      .post('/human-queue/leave')
      .send({ userId });
    expect(res.statusCode).toBe(200);
    expect(res.body.left).toBe(true);
  });

  it('Consulta posição do usuário na fila', async () => {
    const res = await request(app)
      .get('/human-queue/position?userId=' + userId);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('position');
    expect(res.body).toHaveProperty('estimatedTime');
  });
});
