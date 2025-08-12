// Session Manager Utility
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, '../../storage/sessions/session.json');


const logger = require('./logger');
const Sentry = require('@sentry/node');

const saveSession = async (sessionData) => {
  try {
    fs.writeFileSync(SESSION_PATH, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    logger.error('Failed to save session:', error);
    Sentry.captureException(error);
    throw new Error('Failed to save session: ' + error.message);
  }
};

const loadSession = async () => {
  try {
    if (fs.existsSync(SESSION_PATH)) {
      const data = fs.readFileSync(SESSION_PATH);
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    logger.error('Failed to load session:', error);
    Sentry.captureException(error);
    throw new Error('Failed to load session: ' + error.message);
  }
};

module.exports = { saveSession, loadSession };
