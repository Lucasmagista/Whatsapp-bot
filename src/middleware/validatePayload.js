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

const validateMessage = [
  body('from').optional().isString().trim().escape(),
  body('body').isString().trim().customSanitizer(value => sanitize(value)),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateOrder, validateMessage };
