// Catalog Service
const Product = require('../models/Product');
module.exports = {
  async listActiveProducts() {
    return await Product.findAll({ where: { isActive: true } });
  }
};
