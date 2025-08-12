// src/controllers/alertRuleController.js
// Controller para regras dinâmicas de alerta

const AlertRuleService = require('../services/alertRuleService');

const alertRuleController = {
  list: (req, res) => {
    const rules = AlertRuleService.listRules();
    res.json(rules);
  },
  create: (req, res) => {
    const rule = AlertRuleService.createRule(req.body);
    res.status(201).json(rule);
  },
  update: (req, res) => {
    const { id } = req.params;
    const rule = AlertRuleService.updateRule(id, req.body);
    if (!rule) return res.status(404).json({ error: 'Regra não encontrada' });
    res.json(rule);
  },
  delete: (req, res) => {
    const { id } = req.params;
    const rule = AlertRuleService.deleteRule(id);
    if (!rule) return res.status(404).json({ error: 'Regra não encontrada' });
    res.json({ success: true });
  },
  get: (req, res) => {
    const { id } = req.params;
    const rule = AlertRuleService.getRule(id);
    if (!rule) return res.status(404).json({ error: 'Regra não encontrada' });
    res.json(rule);
  }
};

module.exports = alertRuleController;
