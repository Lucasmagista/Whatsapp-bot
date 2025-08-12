// Mock do model Order para evitar dependência do banco de dados nos testes de autenticação
jest.mock('../src/models/Order', () => ({
  findAll: jest.fn(async () => []),
  create: jest.fn(async (data) => ({ ...data, id: 'mockOrderId' }))
}));
// Mock do google-translate-api para evitar dependência externa nos testes
jest.mock('google-translate-api', () => jest.fn((text, opts) => Promise.resolve({ text: `[traduzido] ${text}` })));

// Mock global de Redis para todos os testes
jest.mock('../src/config/redis', () => {
  class RedisMock {
    async lrem(key, count, value) {
      if (!this.data[key]) return 0;
      let removed = 0;
      this.data[key] = this.data[key].filter(item => {
        if (item === value && (count === 0 || removed < Math.abs(count))) {
          removed++;
          return false;
        }
        return true;
      });
      return removed;
    }
    constructor() {
      this.data = {};
    }
    async get(key) { return this.data[key] || null; }
    async set(key, value) { this.data[key] = value; return 'OK'; }
    async del(key) { delete this.data[key]; return 1; }
    async lpush(key, value) {
      if (!this.data[key]) this.data[key] = [];
      this.data[key].unshift(value);
      return this.data[key].length;
    }
    async rpush(key, value) {
      if (!this.data[key]) this.data[key] = [];
      this.data[key].push(value);
      return this.data[key].length;
    }
    async lpop(key) {
      if (!this.data[key] || !this.data[key].length) return null;
      return this.data[key].shift();
    }
    async rpop(key) {
      if (!this.data[key] || !this.data[key].length) return null;
      return this.data[key].pop();
    }
    async llen(key) {
      if (!this.data[key]) return 0;
      return this.data[key].length;
    }
    async lrange(key, start, stop) {
      if (!this.data[key]) return [];
      return this.data[key].slice(start, stop + 1);
    }
    async exists(key) { return this.data[key] ? 1 : 0; }
    async expire() { return 1; }
    async quit() { return 'OK'; }
  }
  return {
    redis: new RedisMock(),
    connectRedis: jest.fn(() => Promise.resolve()),
    redisType: 'mock',
  };
});

// Mock global de JWT para autenticação
// Mock do jsonwebtoken para garantir que jwt.verify retorna usuário válido para token correto e lança erro para token inválido
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, secret) => {
    if (token === 'mocked.jwt.token') {
      return { id: 'mockUserId', role: 'admin' };
    } else {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      throw err;
    }
  }),
  sign: jest.fn(() => 'mocked.jwt.token')
}));
jest.mock('../src/utils/jwtSecretManager', () => ({
  getSecret: () => 'test_jwt_secret',
  initSecretManager: () => Promise.resolve('test_jwt_secret'),
  verifyToken: jest.fn(() => ({ userId: 'mockUserId', role: 'admin' })),
  signToken: jest.fn(() => 'mocked.jwt.token')
}));

// Mock dos models usados em contextTransferService
jest.mock('../src/models/ConversationState', () => ({
  findByUserId: jest.fn(async (userId) => ({ userId, state: 'mocked-state' }))
}));
jest.mock('../src/models/User', () => ({
  findById: jest.fn(async (userId) => ({ id: userId, name: 'Mock User' }))
}));
