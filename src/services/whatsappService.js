
const logger = require('../utils/logger');
const { sendToDashboard } = require('./dashboardWebhookService');
// WhatsApp Service real com WPPConnect
const wppconnect = require('@wppconnect-team/wppconnect');
let client = null;

async function initializeWhatsApp(io) {
  client = await wppconnect.create({
    session: 'default',
    catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
      if (base64Qr) {
        const logger = require('../utils/logger');
        logger.info('Emitindo evento whatsapp-qr', { attempts, hasQr: true, base64QrLength: base64Qr.length });
        // Exibir QR em ASCII no terminal
        if (asciiQR && asciiQR.length > 0) {
          logger.info('QR Code para escanear no terminal:');
          logger.info(asciiQR);
        }
        // Link para abrir a página web de escaneamento do QR Code
        const publicHost = process.env.PUBLIC_HOST || 'http://localhost:3001';
        logger.info('Abra a página para escanear o QR Code:');
        logger.info(`${publicHost}/whatsapp-qr.html`);
      } else {
        logger.warn('NÃO FOI GERADO QR CODE! Apague a pasta tokens/default ou sessions/default e reinicie o servidor.');
      }
      io.emit('whatsapp-qr', { qr: base64Qr, attempts });
      sendToDashboard('whatsapp-qr', { qr: base64Qr, attempts });
    },
    statusFind: (statusSession, session) => {
  io.emit('whatsapp-status', { status: statusSession, session });
  sendToDashboard('whatsapp-status', { status: statusSession, session });
    },
    headless: true,
    logQR: false
  });

  io.emit('whatsapp-status', { status: 'inicializado' });
  sendToDashboard('whatsapp-status', { status: 'inicializado' });

  client.onStateChange((state) => {
    io.emit('whatsapp-status', { status: state });
    sendToDashboard('whatsapp-status', { status: state });
  });

  // Handler para responder automaticamente a qualquer mensagem recebida
  const { transcribeAudio } = require('./whisperService');
  const { processNLP } = require('./nlpOrchestrator');
  let userState = {};
  async function handleAudioMessage(message) {
    const mediaData = await client.downloadMedia(message);
    let transcript = null;
    if (mediaData?.data) {
      const audioBuffer = Buffer.from(mediaData.data, 'base64');
      const tempPath = path.join(__dirname, '../../storage/media/', `${message.id}.ogg`);
      fs.writeFileSync(tempPath, audioBuffer);
      transcript = await transcribeAudio(tempPath);
  io.emit('conversation-transcript', { from: message.from, transcript });
  sendToDashboard('conversation-transcript', { from: message.from, transcript });
      fs.unlinkSync(tempPath);
    }
    // Fluxo do bot
    if (!userState[message.from]?.name) {
      await client.sendText(message.from, 'Olá! Qual seu nome?');
      userState[message.from] = { step: 'ask_name', lastTranscript: transcript };
    } else if (transcript) {
      const aiResult = await processNLP(transcript, { phoneNumber: message.from });
      await client.sendText(message.from, aiResult.response);
      userState[message.from].intent = aiResult.intent;
      userState[message.from].lastTranscript = transcript;
    }
  }

  async function handleAskName(message) {
    userState[message.from].name = message.body;
    await client.sendText(message.from, `Obrigado, ${message.body}! Como posso ajudar?`);
  }

  async function handleTextMessage(message) {
    const aiResult = await processNLP(message.body, { phoneNumber: message.from });
    if (!aiResult?.response) {
      logger.error('Resposta da IA veio nula ou inválida:', aiResult);
      await client.sendText(message.from, 'Desculpe, não consegui processar sua mensagem no momento.');
      return;
    }
    await client.sendText(message.from, aiResult.response);
  }

  async function handleMediaMessage(message) {
    // Baixa a mídia
    const mediaData = await client.downloadMedia(message);
    if (mediaData?.data) {
      let mediaType = message.type || 'media';
      let fileName = message.filename || `${message.id}.${mediaType}`;
      const filePath = path.join(__dirname, '../../storage/media/', fileName);
      fs.writeFileSync(filePath, Buffer.from(mediaData.data, 'base64'));
    }
  }


  const { getConversationState, setConversationState } = require('../models/ConversationState');
  const { isAttendant, getAttendants } = require('../utils/attendants');
  const { logAudit } = require('../utils/auditLogger');
  const fs = require('fs');
  const path = require('path');
  const LOCK_DIR = path.join(__dirname, '../../userStates/locks');
  if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
  function getLockFile(number) {
    return path.join(LOCK_DIR, `${number.replace(/[^\d]/g, '')}.lock`);
  }
  function acquireLock(number) {
    const lockFile = getLockFile(number);
    try {
      fs.writeFileSync(lockFile, process.pid.toString(), { flag: 'wx' });
      return true;
    } catch {
      return false;
    }
  }
  function releaseLock(number) {
    const lockFile = getLockFile(number);
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
  }

  client.onMessage(async (message) => {
    try {
      if (!message?.from) return;
      const from = message.from;
  // const attendants = getAttendants(); // Removido: não utilizado
      let state = getConversationState(from);

      // Comando: /assumir (atendente assume a conversa) com lock e auditoria
      if (message.body && message.body.trim().toLowerCase() === '/assumir' && isAttendant(from)) {
        if (!acquireLock(from)) {
          await client.sendText(from, 'Outro atendente está tentando assumir esta conversa. Tente novamente em instantes.');
          return;
        }
        try {
          state = getConversationState(from); // re-leitura após lock
          if (state.mode === 'human' && state.attendant === from) {
            await client.sendText(from, 'Você já está atendendo esta conversa.');
          } else if (state.mode === 'human' && state.attendant && state.attendant !== from) {
            await client.sendText(from, 'Esta conversa já está sendo atendida por outro operador.');
          } else {
            state.mode = 'human';
            state.attendant = from;
            setConversationState(from, state);
            logAudit('assumir', { conversation: from, attendant: from });
            await client.sendText(from, 'Você assumiu o atendimento. O bot foi pausado para este cliente.');
          }
        } finally {
          releaseLock(from);
        }
        return;
      }

      // Comando: /encerrar (atendente encerra atendimento humanizado) com lock e auditoria
      if (message.body && message.body.trim().toLowerCase() === '/encerrar' && isAttendant(from)) {
        if (!acquireLock(from)) {
          await client.sendText(from, 'Outro atendente está tentando encerrar esta conversa. Tente novamente em instantes.');
          return;
        }
        try {
          state = getConversationState(from); // re-leitura após lock
          if (state.mode === 'human' && state.attendant === from) {
            state.mode = 'bot';
            logAudit('encerrar', { conversation: from, attendant: from });
            delete state.attendant;
            setConversationState(from, state);
            await client.sendText(from, 'Atendimento humanizado encerrado. O bot voltará a responder normalmente.');
          } else {
            await client.sendText(from, 'Você não está atendendo esta conversa.');
          }
        } finally {
          releaseLock(from);
        }
        return;
      }

      // Se a conversa está em modo humanizado, só o atendente pode responder
      if (state.mode === 'human') {
        if (state.attendant === from) {
          // Mensagem do atendente: entregue normalmente
          // (Aqui pode-se integrar com dashboard, logs, etc)
          return; // Não processa pelo bot
        } else {
          // Se não for o atendente, ignora
          return;
        }
      }

      // Fluxo normal do bot
      if (message.isMedia && message.type === 'audio') {
        await handleAudioMessage(message);
      } else if (message.isMedia) {
        await handleMediaMessage(message);
      } else if (message.body) {
        // Fluxo do bot (mantém)
        if (userState[from] && userState[from].step === 'ask_name') {
          await handleAskName(message);
        } else if (message.body && !message.isMedia) {
          await handleTextMessage(message);
        }
      }
    } catch (err) {
      logger.error('Erro ao responder mensagem:', err);
    }
  });

  return true;
}

async function sendText(to, message) {
  if (!client) throw new Error('WhatsApp não inicializado');
  const result = await client.sendText(to, message);
  return result;
}

module.exports = {
  initializeWhatsApp,
  sendText
};
