# API - Whatsapp Bot

## Autenticação

- JWT via header `Authorization: Bearer <token>` para rotas protegidas.

## Endpoints Principais

### [POST] /api/message

Envia mensagem para WhatsApp e fila.

**Body:**
```json
{
    "to": "+5511999999999",
    "message": "Olá!",
    "options": {}
}
```
**Resposta:**
```json
{
    "success": true,
    "message": "Mensagem enviada."
}
```

### [POST] /api/order (auth)
Cria um novo pedido.

**Body:**
```json
{
    "items": [{"id": "uuid-produto", "quantity": 2}],
    "total": 199.98
}
```
**Resposta:**
```json
{
    "success": true
}
```

### [GET] /api/catalog
Lista todos os produtos ativos.

**Resposta:**
```json
[
    { "id": "uuid", "name": "Produto", "price": 99.99 }
]
```

### [GET] /api/order/:id (auth)
Consulta um pedido pelo ID.

### [GET] /api/orders (auth)
Lista todos os pedidos do usuário autenticado.

### [POST] /webhook/whatsapp
Recebe eventos do WhatsApp (usado para integrações externas).

### [GET] /admin/users (auth)
Lista todos os usuários (admin).

### [GET] /admin/orders (auth)
Lista todos os pedidos (admin).

### [GET] /admin/logs (auth)
Retorna logs do sistema.

---

## Exemplos de Integração

### Integração com IA (OpenAI)
```js
const { Configuration, OpenAIApi } = require('openai');
const config = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(config);
const response = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
        { role: 'system', content: 'Você é um atendente.' },
        { role: 'user', content: 'Quero fazer um pedido.' }
    ]
});
console.log(response.data.choices[0].message.content);
```

### Envio de E-mail (nodemailer)
```js
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});
await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: 'destino@exemplo.com',
    subject: 'Assunto',
    text: 'Mensagem do sistema.'
});
```

### Envio de SMS (Twilio)
```js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
await client.messages.create({
    body: 'Sua entrega está a caminho!',
    from: process.env.TWILIO_PHONE,
    to: '+5511999999999'
});
```

---

## Scripts de Inicialização

### Rodar migrações
```bash
psql -U postgres -d whatsapp_bot -f database/migrations/init.sql
```

### Rodar seeds
```bash
psql -U postgres -d whatsapp_bot -f database/seeds/init.sql
```

### Inicializar ambiente
```bash
cp .env.example .env
npm install
npm start
```

---

## Observações
- Todos os endpoints retornam JSON.
- Use JWT para autenticação nas rotas protegidas.
- Consulte o código dos controllers para detalhes de cada resposta.
