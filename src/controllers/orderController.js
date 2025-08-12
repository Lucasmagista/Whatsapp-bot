
const Order = require('../models/Order');
const { isUUID } = require('../utils/validators');
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');
const { validateOrder, validateOrderId } = require('../middleware/validateOrder');

const create = [
  ...validateOrder,
  async (req, res) => {
    try {
      const { items, total } = req.body;
      const userId = req.user.id;
      // Sanitização dos itens
      const sanitizedItems = items.map(item => ({
        ...item,
        name: typeof item.name === 'string' ? item.name.trim() : item.name
      }));
      const order = await Order.create({ userId, items: sanitizedItems, total });
      res.status(201).json(order);
    } catch (error) {
      logger.error('Erro ao criar pedido:', error);
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  }
];

const list = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.findAll({ where: { userId } });
    res.status(200).json(orders);
  } catch (error) {
    logger.error('Erro ao listar pedidos:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
};

const getOrderById = [
  ...validateOrderId,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isUUID(id)) return res.status(400).json({ error: 'ID inválido' });
      const order = await Order.findByPk(id);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
      res.json(order);
    } catch (err) {
      logger.error('Erro ao buscar pedido:', err);
      Sentry.captureException(err);
      next(err);
    }
  }
];

module.exports = { create, list, getOrderById };
