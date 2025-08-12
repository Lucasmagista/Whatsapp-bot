

# API Whatsapp Bot – Documentação Oficial

## Sumário
- [Visão Geral](#visão-geral)
- [Autenticação](#autenticação)
- [Versionamento](#versionamento)
- [Status HTTP e Tratamento de Erros](#status-http-e-tratamento-de-erros)
- [Limites de Uso (Rate Limit)](#limites-de-uso-rate-limit)
- [Endpoints](#endpoints)
- [Exemplos de Integração](#exemplos-de-integração)
- [Scripts de Inicialização](#scripts-de-inicialização)
- [Boas Práticas](#boas-práticas)
- [Segurança e Recomendações](#segurança-e-recomendações)
- [Observações Gerais](#observações-gerais)

---

---


## Visão Geral
API RESTful robusta para integração com WhatsApp, gerenciamento de pedidos, catálogo de produtos e administração. Todas as respostas seguem o padrão JSON. Rotas protegidas exigem autenticação JWT. Suporte a versionamento, limites de uso e integração com sistemas externos.

**Principais recursos:**
- Envio e recebimento de mensagens WhatsApp
- Gerenciamento de pedidos e catálogo
- Webhooks para integrações
- Rotas administrativas
- Suporte a integrações com IA, e-mail e SMS

---

---


## Autenticação

- **Tipo:** JWT (JSON Web Token)
- **Header:** `Authorization: Bearer <token>`
- **Como obter:** Consulte o endpoint de login (não documentado aqui, consulte o time de backend).
- **Exemplo:**
    ```http
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
    ```
- **Rotas protegidas:** indicadas com (auth)
- **Expiração:** Tokens possuem tempo de expiração configurável. Renove periodicamente.
- **Permissões:** O payload do JWT pode conter claims de permissão (ex: `role: admin`).

**Dica:** Sempre valide o token no backend e nunca confie apenas no frontend.

---

---


## Versionamento
- **Versão atual:** v1
- Recomenda-se enviar o header `Accept-Version: v1` para garantir compatibilidade futura.
- Mudanças de breaking change serão comunicadas com antecedência.

---

---


## Status HTTP e Tratamento de Erros

Todas as respostas seguem os padrões HTTP:

| Código | Significado           | Quando ocorre                                 |
|--------|----------------------|-----------------------------------------------|
| 200    | OK                   | Sucesso em requisições GET/PUT/DELETE         |
| 201    | Created              | Sucesso em criação (POST)                     |
| 204    | No Content           | Sucesso sem retorno de corpo                  |
| 400    | Bad Request          | Erro de validação ou parâmetros               |
| 401    | Unauthorized         | Token ausente ou inválido                     |
| 403    | Forbidden            | Sem permissão                                 |
| 404    | Not Found            | Recurso não encontrado                        |
| 409    | Conflict             | Conflito de dados (ex: duplicidade)           |
| 422    | Unprocessable Entity | Erro de validação semântica                   |
| 429    | Too Many Requests    | Limite de requisições excedido                |
| 500    | Internal Server Error| Erro inesperado no servidor                   |

**Exemplo de resposta de erro:**
```json
{
    "success": false,
    "error": {
        "code": 400,
        "message": "Campo 'to' é obrigatório.",
        "details": [
            { "field": "to", "error": "Formato inválido" }
        ]
    }
}
```

**Boas práticas:**
- Sempre trate erros no frontend e exiba mensagens amigáveis ao usuário.
- Consulte o campo `details` para erros de validação múltipla.

---

---


## Limites de Uso (Rate Limit)

- O sistema pode limitar o número de requisições por IP/token.
- Limites típicos: 100 requisições/minuto por token (ajustável).
- Headers de resposta:
    - `X-RateLimit-Limit`: limite total
    - `X-RateLimit-Remaining`: requisições restantes
    - `Retry-After`: segundos até liberar

**Exemplo de resposta ao exceder o limite:**
```json
{
    "success": false,
    "error": {
        "code": 429,
        "message": "Limite de requisições excedido. Tente novamente em 60 segundos."
    }
}
```

---

---


## Endpoints

> **Observação:** Parâmetros obrigatórios estão marcados com *(obrigatório)*. Consulte exemplos de respostas de erro para cada endpoint.


### [POST] /api/message
Envia mensagem para WhatsApp e adiciona à fila.

**Headers:**
- `Content-Type: application/json`

**Body:**
| Campo      | Tipo     | Descrição                        |
|------------|----------|----------------------------------|
| to*        | string   | Número do destinatário (E.164)   |
| message*   | string   | Texto da mensagem                |
| options    | object   | Opções extras (ex: mídia)        |

```json
{
    "to": "+5511999999999",
    "message": "Olá!",
    "options": {
        "mediaUrl": "https://exemplo.com/imagem.jpg"
    }
}
```
**Resposta 200:**
```json
{
    "success": true,
    "message": "Mensagem enviada."
}
```
**Resposta 400:**
```json
{
    "success": false,
    "error": { "code": 400, "message": "Campo 'to' inválido." }
}
```

---


### [POST] /api/order (auth)
Cria um novo pedido.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
| Campo      | Tipo     | Descrição                        |
|------------|----------|----------------------------------|
| items*     | array    | Lista de itens do pedido         |
| total*     | number   | Valor total                      |

```json
{
    "items": [
        { "id": "uuid-produto", "quantity": 2 }
    ],
    "total": 199.98
}
```
**Resposta 201:**
```json
{
    "success": true,
    "orderId": "uuid-pedido"
}
```
**Resposta 400:**
```json
{
    "success": false,
    "error": { "code": 400, "message": "Itens obrigatórios." }
}
```

---


### [GET] /api/catalog
Lista todos os produtos ativos.

**Resposta 200:**
```json
[
    { "id": "uuid", "name": "Produto", "price": 99.99 }
]
```

---


### [GET] /api/order/:id (auth)
Consulta um pedido pelo ID.

**Headers:**
- `Authorization: Bearer <token>`

**Resposta 200:**
```json
{
    "id": "uuid-pedido",
    "items": [ { "id": "uuid-produto", "quantity": 2 } ],
    "total": 199.98,
    "status": "pending"
}
```
**Resposta 404:**
```json
{
    "success": false,
    "error": { "code": 404, "message": "Pedido não encontrado." }
}
```

---


### [GET] /api/orders (auth)
Lista todos os pedidos do usuário autenticado.

**Headers:**
- `Authorization: Bearer <token>`

**Resposta 200:**
```json
[
    { "id": "uuid-pedido", "total": 199.98, "status": "pending" }
]
```

---


### [POST] /webhook/whatsapp
Recebe eventos do WhatsApp (para integrações externas).

**Body:**
| Campo      | Tipo     | Descrição                        |
|------------|----------|----------------------------------|
| event*     | string   | Tipo de evento (ex: message)     |
| data*      | object   | Dados do evento                  |

```json
{
    "event": "message",
    "data": { /* ... */ }
}
```
**Resposta 200:**
```json
{ "success": true }
```

---


### [GET] /admin/users (auth)
Lista todos os usuários (admin).

**Headers:**
- `Authorization: Bearer <token>`

**Resposta 200:**
```json
[
    { "id": "uuid", "name": "Admin", "role": "admin" }
]
```

---


### [GET] /admin/orders (auth)
Lista todos os pedidos (admin).

**Headers:**
- `Authorization: Bearer <token>`

**Resposta 200:**
```json
[
    { "id": "uuid-pedido", "user": "uuid-user", "total": 199.98 }
]
```

---


### [GET] /admin/logs (auth)
Retorna logs do sistema.

**Headers:**
- `Authorization: Bearer <token>`

**Resposta 200:**
```json
[
    { "timestamp": "2025-08-12T12:00:00Z", "event": "login", "user": "uuid" }
]
```

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

---


## Boas Práticas
- Sempre valide os dados enviados no body (use bibliotecas como Joi, Yup ou Zod).
- Utilize HTTPS para todas as requisições.
- Armazene o token JWT de forma segura (ex: HTTPOnly Cookie ou Secure Storage).
- Trate e exponha erros de forma padronizada.
- Consulte os status HTTP para lógica de tratamento no frontend.
- Documente integrações customizadas e mantenha exemplos atualizados.
- Utilize variáveis de ambiente para segredos e configurações.

---

## Segurança e Recomendações
- Nunca exponha segredos (tokens, senhas) em código-fonte público.
- Sempre valide e sanitize entradas do usuário.
- Implemente CORS restritivo para domínios confiáveis.
- Monitore logs e falhas de autenticação.
- Atualize dependências regularmente.
- Utilize autenticação de dois fatores para administradores.

---

---


## Observações Gerais
- Todos os endpoints retornam JSON.
- Use JWT para autenticação nas rotas protegidas.
- Consulte o código dos controllers para detalhes de cada resposta.
- Em caso de dúvidas, consulte o time de backend.
- Sugestões de melhoria são bem-vindas via pull request ou contato direto.
