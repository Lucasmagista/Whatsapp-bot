# Monitoramento

## Prometheus
- Endpoint de métricas: `/metrics`
- Exemplo de configuração Prometheus:
```yaml
scrape_configs:
  - job_name: 'whatsapp-bot'
    static_configs:
      - targets: ['localhost:3000']
```
- Métricas customizadas: veja `src/routes/metrics.js`

## Sentry
- Configure DSN em `.env`
- Erros e exceções são enviados automaticamente

## Logs
- Logs estruturados em `logs/`
- Use ferramentas como ELK, Datadog ou Loki para centralizar

## Alertas
- Configure alertas para filas Redis, erros críticos e uso de recursos
