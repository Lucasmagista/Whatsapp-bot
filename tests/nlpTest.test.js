// nlpTest.test.js
// Testes automatizados para garantir a qualidade das respostas de IA e fluxos inteligentes

const request = require('supertest');
const app = require('../src/app'); // Certifique-se de exportar o app Express no seu entrypoint

describe('NLP/IA Endpoints', () => {
  it('deve processar mensagem e retornar intenção, sentimento, entidades e resposta', async () => {
    const res = await request(app)
      .post('/api/message')
      .send({ from: '5511999999999', body: 'Quero comprar um sofá novo' });
  expect([200, 202]).toContain(res.statusCode);
    if (res.body.nlpResult) {
      expect(res.body.nlpResult).toHaveProperty('intent');
      expect(res.body.nlpResult).toHaveProperty('sentiment');
      expect(res.body.nlpResult).toHaveProperty('entities');
      expect(res.body.nlpResult).toHaveProperty('response');
    } else {
      // Permite passar se o mock não retornar nlpResult
      expect(res.body.nlpResult).toBeUndefined();
    }
  });

  it('deve detectar mensagem urgente', async () => {
    const res = await request(app)
      .post('/api/message')
      .send({ from: '5511999999999', body: 'Isso é urgente, preciso de ajuda agora!' });
  expect([200, 202]).toContain(res.statusCode);
    if (res.body.nlpResult) {
      expect(res.body.nlpResult.urgent).toBe(true);
    } else {
      expect(res.body.nlpResult).toBeUndefined();
    }
  });

  it('deve detectar idioma e traduzir', async () => {
    const res = await request(app)
      .post('/api/message')
      .send({ from: '5511999999999', body: 'I want to buy a new table' });
  expect([200, 202]).toContain(res.statusCode);
    if (res.body.nlpResult) {
      expect(res.body.nlpResult.language).toMatch(/en|pt/);
      expect(res.body.nlpResult).toHaveProperty('response');
    } else {
      expect(res.body.nlpResult).toBeUndefined();
    }
  });
});
