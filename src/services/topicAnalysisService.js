// topicAnalysisService.js
// Análise de tópicos e tendências nas conversas

const redisConfig = require('../config/redis');
const redis = redisConfig.redis;
const { Configuration, OpenAIApi } = require('openai');

async function extractTopicsFromText(text) {
  // Usa OpenAI para extrair tópicos principais de um texto
  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);
  const completion = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Extraia os principais tópicos ou temas desta mensagem. Responda apenas com uma lista separada por vírgula.' },
      { role: 'user', content: text }
    ]
  });
  return completion.data.choices[0].message.content.trim().split(',').map(t => t.trim());
}

async function getTrendingTopics() {
  const keys = await redis.keys('context:*');
  const topicCounts = {};
  for (const key of keys) {
    const ctx = JSON.parse(await redis.get(key));
    if (ctx.history) {
      for (const msg of ctx.history) {
        if (msg.message) {
          const topics = await extractTopicsFromText(msg.message);
          topics.forEach(topic => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
          });
        }
      }
    }
  }
  // Retorna os tópicos mais frequentes
  return Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).map(([topic, count]) => ({ topic, count }));
}

module.exports = { getTrendingTopics };
