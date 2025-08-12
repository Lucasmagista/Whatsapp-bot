// utils/attendants.js
// Utilitário para buscar e validar números de atendentes do .env

const attendants = process.env.ATTENDANTS_NUMBERS
  ? process.env.ATTENDANTS_NUMBERS.split(',').map(n => n.trim())
  : [];

function isAttendant(number) {
  return attendants.includes(number);
}

function getAttendants() {
  return attendants;
}

module.exports = { isAttendant, getAttendants };
