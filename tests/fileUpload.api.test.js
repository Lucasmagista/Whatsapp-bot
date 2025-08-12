const request = require('supertest');
const app = require('../src/app');
const path = require('path');

describe('API - File Upload', () => {
  it('faz upload de TXT e traduz', async () => {
    const res = await request(app)
      .post('/file-upload')
      .attach('file', path.join(__dirname, 'fixtures', 'sample.txt'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('text');
    expect(res.body).toHaveProperty('translated');
  });
});
