const request = require('supertest');
const app = require('../src/app');

describe('File Upload e Tradução', () => {
  it('retorna erro se não enviar arquivo', async () => {
    const res = await request(app).post('/file-upload').send({});
    expect(res.status).toBe(400);
  });
});
