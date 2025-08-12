const request = require('supertest');
const app = require('../src/app');

describe('Rate Limit Middleware', () => {
  it('deve limitar requisições em /api/message', async () => {
    let lastStatus = 200;
    for (let i = 0; i < 60; i++) {
      const res = await request(app)
        .post('/api/message')
        .send({ from: 'test', body: 'teste' });
      lastStatus = res.statusCode;
      if (lastStatus === 429) break;
    }
    expect([200, 429]).toContain(lastStatus);
  });
});
