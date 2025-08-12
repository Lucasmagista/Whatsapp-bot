const request = require('supertest');

const app = require('../src/app');

describe('Auth Middleware', () => {
  // Usa o token mockado do setupTestEnv.js
  const validToken = 'mocked.jwt.token';

  it('deve bloquear requisição sem token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Token não fornecido/);
  });

  it('deve bloquear requisição com token inválido', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer tokeninvalido');
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Token inválido/);
  });

  it('deve permitir requisição com token válido', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${validToken}`);
    // O status pode variar dependendo da implementação do controller
    expect([200, 404, 500]).toContain(res.statusCode);
  });
});
