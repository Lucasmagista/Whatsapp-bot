// WhatsApp configuration
module.exports = {
  sessionName: process.env.WHATSAPP_SESSION_NAME || 'bot-principal',
  multidevice: process.env.WHATSAPP_MULTIDEVICE === 'true'
};
