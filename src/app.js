require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { connectDatabase } = require('./config/database');
const redisConfig = require('./config/redis');
const rateLimitMiddleware = require('./middleware/rateLimit');
const { sequelize } = require('./config/database');
const logger = require('./utils/logger');
let Sentry;
const sentryDsn = process.env.SENTRY_DSN;
const sentryEnabled = sentryDsn && sentryDsn !== 'sua_sentry_dsn' && sentryDsn !== '';
if (sentryEnabled) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENV,
    release: process.env.SENTRY_RELEASE
  });
}
const path = require('path');

const app = express();
// Rate limit global
app.use(rateLimitMiddleware);

// Endpoint para monitorar status das filas Bull
const { getQueueStatus } = require('./queue/messageQueue');
app.get('/queue-status', async (req, res) => {
  try {
    const names = ['message', 'invoice', 'delivery', 'email'];
    const status = {};
    for (const name of names) {
      status[name] = await getQueueStatus(name);
    }
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
// ...existing code...

// Conexões (Redis/DB) são inicializadas em src/server.js

// Rota de métricas Prometheus

// Rota de métricas Prometheus
const metricsRouter = require('./routes/metrics');
app.use(metricsRouter);
// Healthcheck endpoint para Kubernetes
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
// Readiness probe: valida DB e Redis
app.get('/readyz', async (req, res) => {
  try {
    // Verifica DB
    await sequelize.authenticate();
    // Verifica Redis
    if (redisConfig.redis) {
      await redisConfig.redis.ping();
    }
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    logger.error('Readiness check failed:', err);
    res.status(503).json({ status: 'not_ready', error: err.message });
  }
});



// ...existing code...

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
        "script-src-elem": ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
        "connect-src": ["'self'", "ws:", "http://localhost:3000"],
        "img-src": ["'self'", "data:"]
      }
    }
  })
);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001').split(',');
app.use(cors({
  origin: function (origin, callback) {
    // Permite requests sem origin (ex: healthcheck, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));
// Webhook para dashboard receber eventos do bot
app.use('/dashboard-webhook', require('./routes/dashboardWebhook'));
// CRUD de regras de alerta
app.use('/alert-rules', require('./routes/alertRules'));
// Upload e tradução de arquivos de texto
app.use('/file-upload', require('./routes/fileUpload'));
// Fila de espera para atendimento humano
app.use('/human-queue', require('./routes/humanQueue'));
// Transferência de contexto/histórico bot-humano
app.use('/context-transfer', require('./routes/contextTransfer'));

// Documentação automática Swagger
require('./config/swagger')(app);
// ...existing code...
if (sentryEnabled) {
  app.use(Sentry.Handlers.requestHandler());
}
app.use(require('./middleware/errorHandler'));
app.use('/api', require('./routes/api'));
app.use('/webhook', require('./routes/webhook'));
app.use('/admin', require('./routes/admin'));
app.use('/conversation', require('./routes/conversation'));
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

module.exports = app;
