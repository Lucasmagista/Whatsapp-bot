// Message Parser Utility
module.exports = {
  parseMenuOption: (text) => {
    const option = text.trim().replace(/\D/g, '');
    return option;
  },
  parseOrderItems: (text) => {
    // Exemplo: "2x Produto A, 1x Produto B"
    return text.split(',').map(item => {
      const match = item.match(/(\d+)x\s*(.+)/);
      return match ? { quantity: Number(match[1]), name: match[2].trim() } : null;
    }).filter(Boolean);
  }
};
