// reportService.js
// Geração e exportação de relatórios automáticos para BI

const fs = require('fs');
const path = require('path');
const { getIntentStats, getSentimentStats } = require('./analyticsService');
const { getTrendingTopics } = require('./topicAnalysisService');
const { getProviderStats } = require('./providerMonitorService');
const { getAverageQueueWaitTime } = require('../queue/messageQueue');

async function generateReport() {
  const intents = await getIntentStats();
  const sentiments = await getSentimentStats();
  const topics = await getTrendingTopics();
  const openaiStats = await getProviderStats('openai');
  const huggingfaceStats = await getProviderStats('huggingface');
  const avgQueueWait = await getAverageQueueWaitTime('message');
  return {
    generatedAt: new Date().toISOString(),
    intents,
    sentiments,
    topics,
    providerStats: { openai: openaiStats, huggingface: huggingfaceStats },
    avgQueueWaitMs: avgQueueWait
  };
}

async function exportReportToFile(format = 'json') {
  const report = await generateReport();
  const filePath = path.resolve(`./report_${Date.now()}.${format}`);
  if (format === 'json') {
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  } else if (format === 'csv') {
    // Exemplo simples: só exporta intents
    const csv = Object.entries(report.intents).map(([intent, count]) => `${intent},${count}`).join('\n');
    fs.writeFileSync(filePath, `intent,count\n${csv}`);
  }
  return filePath;
}

module.exports = { generateReport, exportReportToFile };
