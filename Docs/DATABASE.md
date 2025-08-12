# Banco de Dados

## Estrutura
- PostgreSQL
- Migrations em `database/migrations/`
- Seeds em `database/seeds/`

## Principais Tabelas
- `User`: usuários
- `Order`: pedidos
- `Product`: produtos
- `Delivery`: entregas
- `Invoice`: notas fiscais
- `Resume`: currículos

## Exemplo de Query
```sql
SELECT * FROM "Orders" WHERE "userId" = '...';
```

## Inicialização
- Scripts em `scripts/init_db.ps1` e `init_db.sh`
