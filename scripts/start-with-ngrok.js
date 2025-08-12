// Script para iniciar ngrok (binário do sistema) e o servidor juntos
const { exec, spawn } = require('child_process');
const logger = require('../src/utils/logger');

const PORT = process.env.PORT || 3001;
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;

// Inicia ngrok via shell
const ngrokCmd = NGROK_AUTHTOKEN
  ? `ngrok http ${PORT} --authtoken=${NGROK_AUTHTOKEN} --log=stdout`
  : `ngrok http ${PORT} --log=stdout`;

const ngrokProc = spawn(ngrokCmd, { shell: true });
let publicUrl = null;

ngrokProc.stdout.on('data', (data) => {
  const str = data.toString();
  // Captura a URL pública do ngrok
  const match = str.match(/(https:\/\/[^\s]+\.ngrok\.io)/);
  if (match && !publicUrl) {
    publicUrl = match[1];
    logger.info(`NGROK tunnel aberto: ${publicUrl}`);
  console.log(`\n\x1b[32mNGROK tunnel: ${publicUrl}\x1b[0m\n`);
    // Inicia o servidor com hot reload (nodemon) somente após o túnel estar pronto
    const child = exec('nodemon wppconnect-server.js', (err, stdout, stderr) => {
      if (err) {
        logger.error('Erro ao iniciar o servidor com nodemon:', err);
      }
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  }
  process.stdout.write(data);
});

ngrokProc.stderr.on('data', (data) => {
  process.stderr.write(data);
});

ngrokProc.on('close', (code) => {
  logger.error(`ngrok finalizado com código ${code}`);
});
