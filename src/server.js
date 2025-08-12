const { app } = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Servidor ouvindo na porta ${PORT}`);
  logger.info(`🚀 Server running on port ${PORT}`);
});
