const request = require('supertest');
const app = require('../src/app');

describe('API - Human Queue', () => {
  it('entra e sai da fila', async () => {
    let res = await request(app)
      .post('/human-queue/join')
      .send({ userId: 'user1' });
    expect(res.statusCode).toBe(200);

    res = await request(app)
      .get('/human-queue/position?userId=user1');
    expect(res.statusCode).toBe(200);
  expect([1, null]).toContain(res.body.position);

    res = await request(app)
      .post('/human-queue/leave')
      .send({ userId: 'user1' });
    expect(res.statusCode).toBe(200);
  });
});
