const { body, validationResult } = require('express-validator');
const sanitize = require('sanitize-html');

// Middleware para validação e sanitização de dados recebidos
const validateAndSanitizeMessage = [
  body('to').isString().trim().escape(),
  body('message').isString().trim().customSanitizer(value => sanitize(value)),
  body('options').optional().isObject(),
  body('email').optional().isEmail().normalizeEmail(),
  body('sms').optional().isString().trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateAndSanitizeMessage };
