// JWT Auth Middleware
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  try {
  const { getSecret } = require('../utils/jwtSecretManager');
  const decoded = jwt.verify(token, getSecret());
    req.user = decoded;
    next();
  } catch (err) {
  const logger = require('../utils/logger');
  logger.error('JWT verification error:', err);
    return res.status(403).json({ error: 'Token inválido ou expirado' });
  }
};
