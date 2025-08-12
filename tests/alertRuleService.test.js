const AlertRuleService = require('../src/services/alertRuleService');

describe('AlertRuleService', () => {
  it('cria, atualiza, deleta e lista regras', () => {
    const rule = AlertRuleService.createRule({ type: 'erro', value: 5 });
    expect(rule).toHaveProperty('id');
    const updated = AlertRuleService.updateRule(rule.id, { value: 10 });
    expect(updated.value).toBe(10);
    const all = AlertRuleService.listRules();
    expect(all.length).toBeGreaterThan(0);
    AlertRuleService.deleteRule(rule.id);
    expect(AlertRuleService.getRule(rule.id)).toBeUndefined();
  });
});
