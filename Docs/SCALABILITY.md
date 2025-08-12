# Escalabilidade

## Redis Cluster
- Use Redis em cluster para alta disponibilidade
- Configure `REDIS_URL` para múltiplos nós

## Balanceamento de Carga
- Use NGINX, Traefik ou balanceador cloud
- Escale múltiplas instâncias do bot

## Workers e Filas
- Escale workers Bull para processar jobs em paralelo
- Monitore o tamanho das filas

## Tuning
- Ajuste limites de payload, timeouts e conexões
- Use variáveis de ambiente para tuning

## Dicas
- Monitore filas e recursos
- Use auto scaling no Kubernetes
