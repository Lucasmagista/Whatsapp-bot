
// Mock simples de Redis em memória
const queue = [];
const redisMock = {
  rpush: async (key, userId) => { if (!queue.includes(userId)) queue.push(userId); },
  lrem: async (key, _count, userId) => { const idx = queue.indexOf(userId); if (idx !== -1) queue.splice(idx, 1); },
  lrange: async (key, _start, _end) => [...queue],
};

jest.mock('../src/config/redis', () => ({ redis: redisMock }));
const HumanQueueService = require('../src/services/humanQueueService');

describe('HumanQueueService', () => {
  beforeEach(async () => {
    // Limpa a fila antes de cada teste
    const queue = await HumanQueueService.getHumanQueue();
    for (const user of queue) {
      await HumanQueueService.removeFromHumanQueue(user);
    }
  });

  it('adiciona e remove usuários corretamente', async () => {
    await HumanQueueService.addToHumanQueue('user1');
    await expect(HumanQueueService.getUserPosition('user1')).resolves.toBe(1);
    await HumanQueueService.addToHumanQueue('user2');
    await expect(HumanQueueService.getUserPosition('user2')).resolves.toBe(2);
    await HumanQueueService.removeFromHumanQueue('user1');
    await expect(HumanQueueService.getUserPosition('user2')).resolves.toBe(1);
  });

  it('retorna tempo estimado corretamente', async () => {
    await HumanQueueService.addToHumanQueue('user3');
    await expect(HumanQueueService.getEstimatedWaitTime('user3', 60)).resolves.toBe(60);
    await HumanQueueService.addToHumanQueue('user4');
    await expect(HumanQueueService.getEstimatedWaitTime('user4', 60)).resolves.toBe(120);
  });
});