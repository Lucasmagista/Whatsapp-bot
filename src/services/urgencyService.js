// urgencyService.js
// Detecta urgência e escalonamento automático

const keywords = [
  'urgente', 'reclamação', 'problema grave', 'cancelamento imediato', 'erro crítico', 'não funciona', 'processo judicial', 'procon', 'ameaça', 'fraude', 'indenização', 'insatisfação', 'péssimo', 'horrível', 'inaceitável', 'processar', 'acidente', 'emergência', 'socorro', 'ajuda urgente'
];

function detectUrgency(text, sentiment) {
  const lower = text.toLowerCase();
  const found = keywords.some(k => lower.includes(k));
  if (found || (sentiment && sentiment.toLowerCase() === 'negativo')) {
    return true;
  }
  return false;
}

module.exports = { detectUrgency };
