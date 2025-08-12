// src/models/AlertRule.js
// Modelo para regras dinâmicas de alerta

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const ALERT_RULES_FILE = path.join(__dirname, '../../database/alert_rules.json');

class AlertRule {
  static getAll() {
    if (!fs.existsSync(ALERT_RULES_FILE)) return [];
    const data = fs.readFileSync(ALERT_RULES_FILE, 'utf-8');
    return JSON.parse(data);
  }

  static saveAll(rules) {
    fs.writeFileSync(ALERT_RULES_FILE, JSON.stringify(rules, null, 2));
  }

  static create(rule) {
    const rules = this.getAll();
    const newRule = { id: uuidv4(), ...rule };
    rules.push(newRule);
    this.saveAll(rules);
    return newRule;
  }

  static update(id, updates) {
    const rules = this.getAll();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rules[idx] = { ...rules[idx], ...updates };
    this.saveAll(rules);
    return rules[idx];
  }

  static delete(id) {
    let rules = this.getAll();
    const rule = rules.find(r => r.id === id);
    rules = rules.filter(r => r.id !== id);
    this.saveAll(rules);
    return rule;
  }

  static findById(id) {
    const rules = this.getAll();
    return rules.find(r => r.id === id);
  }
}

module.exports = AlertRule;
