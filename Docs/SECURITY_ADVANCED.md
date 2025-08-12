# Segurança Avançada

## CORS e CSP
- Configure CORS em `src/config/cors.js`
- Use Helmet para CSP

## HTTPS
- Use proxy reverso (NGINX) ou configure HTTPS direto

## Rotação de Tokens
- Altere `JWT_SECRET` periodicamente
- Implemente expiração curta para tokens sensíveis

## Rate Limit Avançado
- Ajuste limites em `src/middleware/rateLimit.js`
- Use Redis para rate limit distribuído

## Logs Sensíveis
- Nunca logue tokens, senhas ou dados pessoais
- Use níveis de log apropriados
