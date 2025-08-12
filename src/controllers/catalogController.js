
const Product = require('../models/Product');
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');
const { validateProductId } = require('../middleware/validateProduct');

const getCatalog = async (req, res, next) => {
  try {
    const products = await Product.findAll({ where: { isActive: true } });
    logger.info({ event: 'get_catalog', user: req.user?.id, count: products.length, timestamp: new Date().toISOString() });
    res.json(products);
  } catch (err) {
    logger.error({ event: 'get_catalog_error', error: err, timestamp: new Date().toISOString() });
    Sentry.captureException(err);
    next(err);
  }
};

const list = async (req, res) => {
  try {
    const products = await Product.findAll();
    logger.info({ event: 'list_products', user: req.user?.id, count: products.length, timestamp: new Date().toISOString() });
    res.status(200).json(products);
  } catch (error) {
    logger.error({ event: 'list_products_error', error, timestamp: new Date().toISOString() });
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
};

const get = [
  ...validateProductId,
  async (req, res) => {
    try {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        logger.warn({ event: 'product_not_found', id: req.params.id, user: req.user?.id, timestamp: new Date().toISOString() });
        return res.status(404).json({ error: 'Produto não encontrado' });
      }
      logger.info({ event: 'get_product', id: req.params.id, user: req.user?.id, timestamp: new Date().toISOString() });
      res.status(200).json(product);
    } catch (error) {
      logger.error({ event: 'get_product_error', error, id: req.params.id, timestamp: new Date().toISOString() });
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  }
];

module.exports = { getCatalog, list, get };
