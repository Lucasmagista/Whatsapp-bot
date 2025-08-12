// utils/auditLogger.js
const fs = require('fs');
const path = require('path');
const AUDIT_LOG = path.join(__dirname, '../../logs/audit.log');

function logAudit(event, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data
  };
  fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
}

module.exports = { logAudit };
