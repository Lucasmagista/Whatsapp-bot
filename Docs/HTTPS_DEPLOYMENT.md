# Protegendo a Dashboard com HTTPS

## Opção 1: HTTPS nativo no Express

1. Gere ou obtenha um certificado SSL (ex: Let's Encrypt, self-signed para testes).
2. Adicione ao seu `src/server.js` ou `wppconnect-server.js`:

```js
const https = require('https');
const fs = require('fs');
const app = require('./src/app'); // ou o caminho correto do seu app

const options = {
  key: fs.readFileSync('caminho/para/privkey.pem'),
  cert: fs.readFileSync('caminho/para/fullchain.pem')
};

https.createServer(options, app).listen(process.env.PORT || 443, () => {
  console.log('Servidor HTTPS rodando!');
});
```

> Lembre-se de remover ou comentar o `app.listen` HTTP padrão.

## Opção 2: Proxy reverso (recomendado para produção)

1. Configure um proxy reverso (Nginx, Caddy, Traefik, etc.) para receber conexões HTTPS e repassar para o Node.js via HTTP local.
2. Exemplo de configuração Nginx:

```
server {
    listen 443 ssl;
    server_name seu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> O proxy reverso é a abordagem mais comum e flexível para produção.
