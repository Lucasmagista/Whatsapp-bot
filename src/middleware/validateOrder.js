const { body, param, validationResult } = require('express-validator');
const sanitize = require('sanitize-html');

const validateOrder = [
  body('items').isArray(),
  body('total').isNumeric(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateOrderId = [
  param('id').isString().trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateOrder, validateOrderId };
