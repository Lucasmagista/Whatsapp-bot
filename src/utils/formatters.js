// Formatters Utility
module.exports = {
  formatCurrency: (value) => `R$ ${Number(value).toFixed(2)}`,
  formatDate: (date) => new Date(date).toLocaleString('pt-BR'),
  formatPhone: (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 13 ? `+${cleaned}` : `+55${cleaned}`;
  }
};
