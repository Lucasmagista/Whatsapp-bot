// Rota para dashboard receber transcrições
const express = require('express');
const router = express.Router();

// Simples endpoint para dashboard escutar transcrições via websocket
router.get('/transcripts', (req, res) => {
  res.status(200).json({ message: 'Use websocket para receber transcrições em tempo real.' });
});

module.exports = router;
