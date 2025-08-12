// googleSpeechService.js
// Serviço alternativo de transcrição de áudio usando Google Speech-to-Text

const fs = require('fs');
const speech = require('@google-cloud/speech');
const logger = require('../utils/logger');

async function transcribeAudioGoogle(filePath, languageCode = 'pt-BR') {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS não configurada');
    }
    const client = new speech.SpeechClient();
    const file = fs.readFileSync(filePath);
    const audioBytes = file.toString('base64');
    const audio = { content: audioBytes };
    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode
    };
    const request = { audio, config };
    const [response] = await client.recognize(request);
    const transcription = response.results.map(r => r.alternatives[0].transcript).join(' ');
    return transcription;
  } catch (error) {
    logger.error('Erro na transcrição Google Speech:', error);
    return null;
  }
}

module.exports = { transcribeAudioGoogle };
