// Database configuration for PostgreSQL
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
      acquire: 10000 // 10 segundos de timeout para conexão
    }
  }
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connected');
  } catch (error) {
    logger.error('Unable to connect to PostgreSQL:', error);
    throw error;
  }
};

module.exports = { sequelize, connectDatabase };
