// src/services/fileUploadService.js
// Serviço para upload e extração/tradução de arquivos de texto

const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const translate = require('google-translate-api');

const uploadDir = path.join(__dirname, '../../uploads/texts');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

async function extractText(filePath, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = fs.readFileSync(filePath);
    const pdf = await pdfParse(data);
    return pdf.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } else if (mimetype === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error('Formato não suportado');
}

async function translateText(text, targetLang = 'en') {
  const res = await translate(text, { to: targetLang });
  return res.text;
}

module.exports = { upload, extractText, translateText };
