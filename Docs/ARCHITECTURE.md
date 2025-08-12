# Arquitetura do Projeto

![Diagrama](./media/order-summary.jpg)

## Camadas
- **API REST**: Express.js
- **WebSocket**: Socket.io
- **Banco de Dados**: PostgreSQL (Sequelize)
- **Fila de Jobs**: Bull + Redis
- **Armazenamento**: MinIO/S3
- **Integração WhatsApp**: WPPConnect
- **Serviços Externos**: OpenAI, Twilio, SMTP

## Estrutura de Pastas
- `src/` — Código principal
- `database/` — Migrations e seeds
- `media/` — Imagens e arquivos
- `storage/` — Logs, sessões, uploads
- `userStates/` — Estados dos usuários

## Dependências
- Node.js, Express, Sequelize, Bull, ioredis, MinIO, WPPConnect, OpenAI, Twilio, Winston
