// models/ConversationState.js
// Gerencia o estado de cada conversa (bot ativo, humanizado, atendente, etc)
const fs = require('fs');
const path = require('path');

const STATES_DIR = path.join(__dirname, '../../userStates');

function getStateKey(number) {
  return `${number.replace(/[^\d]/g, '')}@c.us.json`;
}

function getConversationState(number) {
  const file = path.join(STATES_DIR, getStateKey(number));
  if (!fs.existsSync(file)) return { mode: 'bot' };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data;
  } catch {
    return { mode: 'bot' };
  }
}

function setConversationState(number, state) {
  const file = path.join(STATES_DIR, getStateKey(number));
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

module.exports = { getConversationState, setConversationState };
