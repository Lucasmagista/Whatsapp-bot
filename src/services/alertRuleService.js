// src/services/alertRuleService.js
// Serviço para regras dinâmicas de alerta

const AlertRule = require('../models/AlertRule');

class AlertRuleService {
  static listRules() {
    return AlertRule.getAll();
  }

  static createRule(data) {
    // data: { type, value, keywords, channels }
    return AlertRule.create(data);
  }

  static updateRule(id, updates) {
    return AlertRule.update(id, updates);
  }

  static deleteRule(id) {
    return AlertRule.delete(id);
  }

  static getRule(id) {
    return AlertRule.findById(id);
  }
}

module.exports = AlertRuleService;
