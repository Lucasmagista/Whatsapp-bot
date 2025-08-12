// Order Service
const Order = require('../models/Order');
module.exports = {
  async createOrder(userId, items, total) {
    return await Order.create({ userId, items, total });
  },
  async getOrderById(id) {
    return await Order.findByPk(id);
  },
  async listOrders(userId) {
    return await Order.findAll({ where: { userId } });
  }
};
