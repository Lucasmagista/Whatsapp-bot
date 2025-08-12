# Testes de Integração e E2E

## Como rodar
```bash
npm run test
```

## Mocks
- Use mocks para serviços externos (Redis, IA, e-mail)
- Veja exemplos em `__mocks__/`

## Exemplos de Cenários
- Falha de rede e retry
- Fallback para Redis
- Autenticação inválida
- Limite de payload
- Teste de fila e workers

## Dicas
- Use `supertest` para testar rotas
- Use `jest` para assertions
- Separe testes unitários e integração
