// Error Handler Middleware
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');

module.exports = (err, req, res, next) => {
  logger.error({ event: 'unhandled_error', error: err });
  Sentry.captureException(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    details: err.details || undefined
  });
};
