// queueMetricsRoutes.js
// Endpoint para métricas e alertas das filas

const express = require('express');
const router = express.Router();
const { getAverageQueueWaitTime, checkQueueWaitAlert } = require('../queue/messageQueue');

router.get('/queue/:queueName/metrics', async (req, res) => {
  try {
    const { queueName } = req.params;
    const avgWait = await getAverageQueueWaitTime(queueName);
    const alert = await checkQueueWaitAlert(queueName);
    res.status(200).json({ queueName, avgWaitMs: avgWait, alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
