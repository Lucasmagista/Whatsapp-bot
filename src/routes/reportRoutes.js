// reportRoutes.js
// Endpoint para geração e download de relatórios automáticos

const express = require('express');
const router = express.Router();
const { generateReport, exportReportToFile } = require('../services/reportService');

router.get('/report', async (req, res) => {
  try {
    const report = await generateReport();
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report/download', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filePath = await exportReportToFile(format);
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
