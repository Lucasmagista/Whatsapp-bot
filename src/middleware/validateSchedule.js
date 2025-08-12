const { body, validationResult } = require('express-validator');
const sanitize = require('sanitize-html');

const validateSchedule = [
  body('deliveryDate').optional().isISO8601().toDate(),
  body('address').optional().isString().trim().customSanitizer(value => sanitize(value)),
  body('recipient').optional().isString().trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateSchedule };
