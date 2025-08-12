// Serviço para transcrição de áudio usando OpenAI Whisper
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const logger = require('../utils/logger');


const { transcribeAudioGoogle } = require('./googleSpeechService');
const { detectLanguage } = require('./contextManager');

async function transcribeAudio(filePath) {
  // Detecção automática de idioma (padrão pt-BR)
  let languageCode = 'pt-BR';
  try {
    // (Opcional) Detectar idioma do áudio usando IA/texto
    // Exemplo: se já tiver um trecho de texto, pode usar detectLanguage(text)
    // languageCode = await detectLanguage(text) || 'pt-BR';
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }
    const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);
    const audioStream = fs.createReadStream(filePath);
    const response = await openai.createTranscription(audioStream, 'whisper-1');
    if (response && response.data && response.data.text) {
      return response.data.text;
    }
    throw new Error('Transcrição Whisper vazia');
  } catch (error) {
    const Sentry = require('@sentry/node');
    logger.error('Erro na transcrição Whisper, tentando Google Speech:', error);
    Sentry.captureException(error);
    // Fallback para Google Speech-to-Text
    const googleResult = await transcribeAudioGoogle(filePath, languageCode);
    if (googleResult) return googleResult;
    return null;
  }
}

module.exports = { transcribeAudio };
