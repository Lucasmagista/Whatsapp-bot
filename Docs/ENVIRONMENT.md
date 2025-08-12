# Variáveis de Ambiente

## Exemplo de `.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp
DB_USER=postgres
DB_PASS=senha
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASS=senha
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_ACCESS_KEY=minio
STORAGE_SECRET_KEY=minio123
WHATSAPP_SESSION_NAME=bot-principal
WHATSAPP_MULTIDEVICE=true
OPENAI_API_KEY=sk-...
SMTP_HOST=smtp.mail.com
SMTP_PORT=587
SMTP_USER=usuario@mail.com
SMTP_PASS=senha
TWILIO_SID=...
TWILIO_TOKEN=...
TWILIO_PHONE=+55...
JWT_SECRET=segredo
```

## Recomendações
- Nunca versionar `.env`
