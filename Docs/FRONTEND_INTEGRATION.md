# Integração com Frontend

## Consumo da API REST
- Use fetch/axios para consumir endpoints (ver API_DOC.md)
- Exemplo:
```js
fetch('/api/message', { method: 'POST', body: JSON.stringify({ to, message }) })
```

## WebSocket (Socket.io)
- Conecte-se ao servidor usando:
```js
const socket = io('http://localhost:3000');
socket.on('message', (msg) => { /* ... */ });
```

## Autenticação JWT
- Envie o token no header Authorization
- Exemplo:
```js
fetch('/api/order', { headers: { Authorization: 'Bearer <token>' } })
```

## Exemplos de Payload
- Veja exemplos em `Docs/EXEMPLOS_PAYLOADS.md`
