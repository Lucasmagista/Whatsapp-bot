const request = require('supertest');
const app = require('../src/app');

describe('API - Context Transfer', () => {
  it('salva e recupera contexto', async () => {
    await request(app)
      .post('/context-transfer/transfer')
      .send({ userId: 'user1', operatorId: 'op1' })
      .expect(200);

    const res = await request(app)
      .get('/context-transfer/context?userId=user1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('state');
  });
});
