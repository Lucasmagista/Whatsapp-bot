// Invoice Service
const Invoice = require('../models/Invoice');
module.exports = {
  async generateInvoice(orderId, amount, pdfUrl) {
    return await Invoice.create({ orderId, amount, pdfUrl });
  },
  async getInvoiceById(id) {
    return await Invoice.findByPk(id);
  }
};
