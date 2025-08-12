require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initializeWhatsApp } = require('./services/whatsappService');
const { connectDatabase } = require('./config/database');
const redisConfig = require('./config/redis');
const { initializeQueue } = require('./queue/messageQueue');
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

// Inicializa Redis com fallback Upstash/Local
redisConfig.connectRedis()
  .then(() => logger.info(`[Redis] Inicialização completa (${redisConfig.redisType})`))
  .catch((err) => {
    logger.error(`[Redis] Falha crítica ao inicializar Redis: ${err.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  });

// Rota de métricas Prometheus

// Rota de métricas Prometheus
const metricsRouter = require('./routes/metrics');
app.use(metricsRouter);
// Healthcheck endpoint para Kubernetes
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
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

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
  }
});

async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await connectDatabase();
      logger.info('✅ PostgreSQL connected');
      if (sentryEnabled) { Sentry.captureMessage('PostgreSQL connected'); }

      await connectRedis();
      logger.info('✅ Redis connected');
      if (sentryEnabled) {
        Sentry.captureMessage('Redis connected');
      }

      await initializeQueue();
      logger.info('✅ Queue system initialized');
      if (sentryEnabled) {
        Sentry.captureMessage('Queue system initialized');
      }

      // Inicialize o WhatsApp em paralelo
      initializeWhatsApp(io)
        .then(() => {
          logger.info('✅ WhatsApp initialized');
          if (sentryEnabled) {
            Sentry.captureMessage('WhatsApp initialized');
          }
        })
        .catch((err) => {
          logger.error('Erro ao inicializar WhatsApp:', err);
          if (sentryEnabled) {
            Sentry.captureException(err);
          }
        });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    if (sentryEnabled) {
      Sentry.captureException(error);
    }
    // Só encerra o processo se não estiver em ambiente de teste
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed');
    });
  });
  startServer();
}

module.exports = app;
