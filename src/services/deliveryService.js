// Delivery Service
const Delivery = require('../models/Delivery');
module.exports = {
  async scheduleDelivery(orderId, address, scheduledDate) {
    return await Delivery.create({ orderId, address, scheduledDate });
  },
  async getDeliveryById(id) {
    return await Delivery.findByPk(id);
  }
};
