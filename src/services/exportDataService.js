// exportDataService.js
// Exporta exemplos de mensagens, intenções, sentimentos e entidades para ajuste de modelos ou labeling

const redisConfig = require('../config/redis');
const redis = redisConfig.redis;
const fs = require('fs');
const path = require('path');

async function exportUserContextsToJSON(exportPath = './exported_nlp_data.json') {
  const keys = await redis.keys('context:*');
  const allData = [];
  for (const key of keys) {
    const ctx = JSON.parse(await redis.get(key));
    if (ctx.history && ctx.history.length > 0) {
      ctx.history.forEach(msg => {
        allData.push({
          userId: key.replace('context:', ''),
          ...msg
        });
      });
    }
  }
  fs.writeFileSync(path.resolve(exportPath), JSON.stringify(allData, null, 2));
  return exportPath;
}

module.exports = { exportUserContextsToJSON };
