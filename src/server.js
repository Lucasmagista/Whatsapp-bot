const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');
const redisConfig = require('./config/redis');
const { initializeQueue, queues } = require('./queue/messageQueue');
const { initializeWhatsApp, shutdownWhatsApp } = require('./services/whatsappService');
const { initSecretManager } = require('./utils/jwtSecretManager');

const PORT = parseInt(process.env.PORT || '3001', 10);

async function bootstrap() {
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true
    }
  });

  try {
    const isTestLike = process.env.NODE_ENV === 'test' || process.env.SKIP_BOOTSTRAP === '1';
    if (!isTestLike) {
      await connectDatabase();
      logger.info('✅ PostgreSQL connected');

      await redisConfig.connectRedis();
      logger.info('✅ Redis connected');

      await initializeQueue();
      logger.info('✅ Queue system initialized');

      // Inicializa o WhatsApp em paralelo (não bloqueia startup)
      initializeWhatsApp(io)
        .then(() => logger.info('✅ WhatsApp initialized'))
        .catch((err) => logger.error('Erro ao inicializar WhatsApp:', err));

      // Inicializa rotação de segredo JWT (depende de Redis)
      try {
        await initSecretManager();
        logger.info('✅ JWT Secret Manager initialized');
      } catch (e) {
        logger.error('Erro ao inicializar JWT Secret Manager:', e);
      }
    } else {
      logger.info('Skipping external services bootstrap (test/smoke mode)');
    }

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      try {
        logger.info('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
          logger.info('HTTP server closed');
        });
        // Fecha WhatsApp
        await shutdownWhatsApp();
        // Fecha filas Bull
        if (queues) {
          const closePromises = Object.values(queues)
            .filter(Boolean)
            .map((q) => q.close().catch((e) => logger.error('Erro ao fechar fila:', e)));
          await Promise.all(closePromises);
          logger.info('Queues closed');
        }
        // Fecha Redis
        if (redisConfig.redis) {
          await redisConfig.redis.quit();
          logger.info('Redis connection closed');
        }
        process.exit(0);
      } catch (err) {
        logger.error('Erro no shutdown:', err);
        process.exit(1);
      }
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
