# Estados de Usuário

## Visão Geral
O bot mantém o estado de cada usuário para personalizar o atendimento e garantir continuidade.

## Estrutura
- Arquivos em `userStates/` com dados por usuário
- Estado inclui: etapa do fluxo, pedidos em andamento, últimas interações

## Exemplo de Estado
```json
{
  "userId": "5517991028037@c.us",
  "step": "pedido",
  "lastMessage": "Quero ver o catálogo",
  "currentOrder": {
    "items": [ ... ],
    "status": "em andamento"
  }
}
```

## Vantagens
- Atendimento personalizado
- Continuidade mesmo após desconexão
- Facilidade para auditoria e análise
