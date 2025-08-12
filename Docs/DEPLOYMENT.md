# Guia de Deploy

## Pré-requisitos
- Node.js >= 16
- Docker e Docker Compose (opcional)
- PostgreSQL, Redis, MinIO
- Variáveis de ambiente configuradas (ver ENVIRONMENT.md)

## Deploy com Docker Compose
```bash
docker-compose up -d
```
- Editar `docker-compose.yml` conforme ambiente
- Verifique logs: `docker-compose logs -f`

## Deploy com Kubernetes
- Edite `k8s-deployment.yaml` com suas variáveis
- Aplique:
```bash
kubectl apply -f k8s-deployment.yaml
```
- Monitore pods e serviços

## Deploy manual
- Instale dependências: `npm install`
- Inicie: `npm start` ou `npm run dev`

## Troubleshooting
- Verifique logs em `logs/`
- Cheque variáveis obrigatórias
- Teste endpoints `/healthz` e `/metrics`
- Use `docker logs <container>` para logs em produção
