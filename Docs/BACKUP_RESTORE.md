# Backup e Restore

## Banco de Dados (PostgreSQL)
### Backup
```bash
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup.sql
```
### Restore
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup.sql
```

## Redis
### Backup
- O Redis salva automaticamente em `dump.rdb` (pasta Redis/)
### Restore
- Pare o Redis, substitua o arquivo `dump.rdb` e reinicie

## MinIO (Arquivos)
### Backup
```bash
mc cp --recursive minio/whatsapp-bot/ ./backup/
```
### Restore
```bash
mc cp --recursive ./backup/ minio/whatsapp-bot/
```

## Logs
- Faça backup da pasta `logs/` regularmente
