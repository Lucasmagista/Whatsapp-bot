# Fila de Jobs

## Bull + Redis
- Fila principal: `messageQueue.js`
- Workers: `workers/`
- Jobs: `jobs/`

## Exemplo de Job
```js
addToQueue('email', { to, subject, body });
```

## Workers
- `messageWorker.js`: processa mensagens
- `deliveryWorker.js`: notifica entregas
- `invoiceWorker.js`: gera notas fiscais
- `emailWorker.js`: envia e-mails

## Monitoramento
- Função `getQueueStatus` para status das filas
