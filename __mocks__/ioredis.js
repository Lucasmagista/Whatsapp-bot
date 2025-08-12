// __mocks__/ioredis.js

class RedisMock {
  constructor() {
    this.data = {};
    this.lists = {};
  }
  get(key) { return Promise.resolve(this.data[key] || null); }
  set(key, value) { this.data[key] = value; return Promise.resolve('OK'); }
  del(key) { delete this.data[key]; return Promise.resolve(1); }
  quit() { return Promise.resolve(); }
  on() { return this; }
  // Métodos de lista para fila
  rpush(key, value) {
    if (!this.lists[key]) this.lists[key] = [];
    this.lists[key].push(value);
    return Promise.resolve(this.lists[key].length);
  }
  lrem(key, count, value) {
    if (!this.lists[key]) return Promise.resolve(0);
    let removed = 0;
    this.lists[key] = this.lists[key].filter(v => {
      if (v === value && (count === 0 || removed < count)) {
        removed++;
        return false;
      }
      return true;
    });
    return Promise.resolve(removed);
  }
  lrange(key, start, stop) {
    if (!this.lists[key]) return Promise.resolve([]);
    // Suporte a -1 para pegar até o fim
    const arr = this.lists[key];
    const end = stop === -1 ? arr.length : stop + 1;
    return Promise.resolve(arr.slice(start, end));
  }
}

module.exports = RedisMock;
