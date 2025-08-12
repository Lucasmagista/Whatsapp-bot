# Exemplos de payloads válidos e inválidos

## /api/order (POST)

### Válido
```json
{
  "items": [
    { "id": 1, "qtd": 2 }
  ],
  "total": 100.5
}
```

### Inválido
```json
{
  "items": "não é array",
  "total": "cem"
}
```

## /api/message (POST)

### Válido
```json
{
  "from": "5511999999999",
  "body": "Olá, quero fazer um pedido."
}
```

### Inválido
```json
{
  "body": 12345
}
```

## /webhook/whatsapp (POST)

### Válido
```json
{
  "from": "5511999999999",
  "body": "Mensagem recebida via webhook."
}
```

### Inválido
```json
{
  "from": 12345
}
```
