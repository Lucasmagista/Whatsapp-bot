const request = require('supertest');
const express = require('express');
const app = require('../src/app');

describe('Healthcheck', () => {
  it('deve retornar status 200 e status ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
