// src/routes/alertRules.js
const express = require('express');
const router = express.Router();
const alertRuleController = require('../controllers/alertRuleController');

router.get('/', alertRuleController.list);
router.post('/', alertRuleController.create);
router.get('/:id', alertRuleController.get);
router.put('/:id', alertRuleController.update);
router.delete('/:id', alertRuleController.delete);

module.exports = router;
