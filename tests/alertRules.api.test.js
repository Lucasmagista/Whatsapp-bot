const request = require('supertest');
const app = require('../src/app');

describe('API - Alert Rules', () => {
  let ruleId;

  it('cria uma regra', async () => {
    const res = await request(app)
      .post('/alert-rules')
      .send({ type: 'tempo_fila', value: 60, active: true });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    ruleId = res.body.id;
  });

  it('busca todas as regras', async () => {
    const res = await request(app).get('/alert-rules');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('atualiza uma regra', async () => {
    const res = await request(app)
      .put(`/alert-rules/${ruleId}`)
      .send({ value: 120 });
    expect(res.statusCode).toBe(200);
    expect(res.body.value).toBe(120);
  });

  it('remove uma regra', async () => {
    const res = await request(app).delete(`/alert-rules/${ruleId}`);
    expect(res.statusCode === 200 || res.statusCode === 204).toBe(true);
  });
});
