const User = require('../models/User');
const Order = require('../models/Order');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll();
    logger.info({ event: 'list_users', user: req.user?.id, count: users.length, timestamp: new Date().toISOString() });
    res.json(users);
  } catch (err) {
    logger.error({ event: 'list_users_error', error: err, timestamp: new Date().toISOString() });
    next(err);
  }
};

const listOrders = async (req, res, next) => {
  try {
    const orders = await Order.findAll();
    logger.info({ event: 'list_orders', user: req.user?.id, count: orders.length, timestamp: new Date().toISOString() });
    res.json(orders);
  } catch (err) {
    logger.error({ event: 'list_orders_error', error: err, timestamp: new Date().toISOString() });
    next(err);
  }
};

const getLogs = async (req, res, next) => {
  try {
    const logPath = path.resolve('storage/logs/app.log');
    if (!fs.existsSync(logPath)) {
      logger.warn({ event: 'log_not_found', user: req.user?.id, path: logPath, timestamp: new Date().toISOString() });
      return res.status(404).json({ error: 'Log não encontrado' });
    }
    const logs = fs.readFileSync(logPath, 'utf8');
    logger.info({ event: 'get_logs', user: req.user?.id, path: logPath, timestamp: new Date().toISOString() });
    res.type('text/plain').send(logs);
  } catch (err) {
    logger.error({ event: 'get_logs_error', error: err, timestamp: new Date().toISOString() });
    next(err);
  }
};

const dashboard = async (req, res) => {
  try {
    // Implementar dashboard admin
    logger.info({ event: 'dashboard_access', user: req.user?.id, timestamp: new Date().toISOString() });
    res.status(200).json({ dashboard: true });
  } catch (error) {
    logger.error({ event: 'dashboard_error', error, timestamp: new Date().toISOString() });
    res.status(500).json({ error: error.message });
  }
};

module.exports = { listUsers, listOrders, getLogs, dashboard };
