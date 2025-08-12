### Comando para Atendente Assumir Conversa

Além da atribuição manual pelo admin, o atendente pode assumir uma conversa disponível usando comandos no chat ou botões no painel.

- `/assumir` — O atendente assume a conversa atual (caso esteja disponível/aguardando)
- `/entrar <id>` — O atendente assume uma conversa específica pelo ID

No painel, pode haver um botão "Assumir" ao lado de conversas em fila/aguardando.

Ao assumir, a conversa é atribuída ao atendente, removida da fila de espera e notificada para outros operadores.

#### Exemplo de Payload de Assumir Conversa
```json
{
  "conversationId": "uuid",
  "attendantId": "uuid",
  "action": "assumir",
  "executedAt": "2025-08-08T12:03:00Z",
  "result": "success"
}
```

#### Boas Práticas
- Permita que atendentes vejam e filtrem conversas disponíveis
- Impeça que duas pessoas assumam a mesma conversa simultaneamente (lock/optimistic update)
- Notifique o cliente quando um atendente assumir
- Registre logs de quem assumiu e quando
## Comandos para Atendentes

O sistema pode suportar comandos especiais digitados pelos atendentes no chat ou via painel/admin, para agilizar operações, acionar automações ou registrar ações.

### Exemplos de Comandos no Chat
- `/transferir @joao` — Transfere a conversa para o atendente João
- `/encerrar` — Encerra a conversa atual
- `/nota Cliente pediu reembolso` — Adiciona uma nota interna
- `/faq` — Envia resposta automática de FAQ
- `/espera 10` — Coloca o cliente em espera por 10 minutos
- `/tag urgente` — Marca a conversa como urgente

### Comandos Administrativos (painel)
- Criar/editar/remover atendentes
- Definir status (disponível, ausente, ocupado)
- Gerar relatórios de atendimentos
- Resetar senha de atendente
- Forçar logout de atendente

### Como Funciona
- Comandos iniciados por `/` são interpretados pelo backend e não enviados ao cliente
- Podem ser expandidos conforme necessidade do negócio
- Logs de comandos são registrados para auditoria

### Boas Práticas
- Documente todos os comandos disponíveis no painel
- Permita customização de comandos por perfil
- Implemente confirmação para comandos críticos (ex: encerrar, transferir)
- Restrinja comandos sensíveis a perfis autorizados

### Exemplo de Payload de Comando
```json
{
  "conversationId": "uuid",
  "command": "/transferir @joao",
  "executedBy": "attendant",
  "executedAt": "2025-08-08T12:05:00Z",
  "result": "success"
}
```

# Atendentes no Whatsapp Bot

## Visão Geral
O sistema suporta múltiplos atendentes humanos para transbordo, acompanhamento e finalização de conversas iniciadas pelo bot. Atendentes podem assumir conversas, responder clientes, visualizar histórico, transferir para outros operadores e registrar anotações internas.

O modelo é inspirado em plataformas omnichannel modernas, permitindo integração com Chatwoot, Zendesk, Freshdesk ou dashboards próprios.

## Funcionalidades
- Transbordo automático (por regras) ou manual para atendente
- Painel de atendentes (dashboard/admin) com busca, filtros e ordenação
- Visualização de conversas em tempo real (WebSocket)
- Histórico completo de interações e anotações internas
- Transferência de atendimento entre operadores e times
- Filtros por status (em atendimento, aguardando, finalizado, pendente, transferido)
- Notificações de novas conversas e mensagens
- Encerramento manual, automático (timeout) ou por script
- Registro de métricas detalhadas de atendimento
- SLA configurável por tipo de conversa
- Integração com múltiplos canais (WhatsApp, Web, Email, etc)

## Fluxo de Atendimento
1. Usuário inicia conversa com o bot (WhatsApp ou outro canal)
2. Bot responde automaticamente (FAQ, pedidos, rastreio, etc)
3. Se necessário (palavra-chave, erro, solicitação, timeout), o bot transborda para um atendente humano
4. Atendente recebe notificação e pode assumir a conversa via dashboard/admin
5. Atendente pode responder, transferir, adicionar nota interna, encerrar ou marcar como resolvida
6. Conversa fica registrada para auditoria, métricas e compliance (LGPD)
7. Supervisor pode reabrir, transferir ou auditar conversas

## Permissões e Papéis
- **Atendente**: pode responder, transferir, adicionar notas e encerrar conversas atribuídas
- **Supervisor**: pode visualizar todas as conversas, transferir, reabrir, auditar e gerar relatórios
- **Admin**: gerencia atendentes, permissões, relatórios, configurações e integrações
- **Bot**: pode iniciar, encerrar e transferir conversas automaticamente

## Integração com Dashboard/Admin
- Listagem de conversas em tempo real (WebSocket/REST)
- Filtros avançados por atendente, status, data, canal, tags
- Atribuição manual, automática (round-robin) ou por skill
- Logs detalhados de ações dos atendentes (auditoria)
- Visualização de histórico, anotações e arquivos trocados
- Exportação de conversas e relatórios
- Integração com Chatwoot, Zendesk, etc (opcional)

## APIs Relacionadas
- [GET] /api/conversations: lista conversas
- [GET] /api/conversations/:id: detalhes de uma conversa
- [POST] /api/conversations/:id/assign: atribui atendente
- [POST] /api/conversations/:id/close: encerra conversa
- [POST] /api/conversations/:id/transfer: transfere para outro atendente
- [POST] /api/conversations/:id/note: adiciona nota interna
- [GET] /api/attendants: lista atendentes
- [POST] /api/attendants: cria novo atendente
- [PATCH] /api/attendants/:id: atualiza atendente

## Métricas e Relatórios
- Tempo médio de atendimento (TMA)
- Tempo de espera do cliente
- Conversas resolvidas por atendente
- Taxa de transbordo (bot → humano)
- SLA de resposta e de resolução
- Conversas reabertas
- Transferências por atendente/time
- Feedback do cliente (NPS, CSAT)
- Volume por canal e horário

## Boas Práticas
- Defina SLAs claros para resposta e resolução
- Treine atendentes para uso do painel e scripts de atendimento
- Monitore métricas, feedbacks e qualidade das respostas
- Implemente notificações (push, e-mail, web) para novos atendimentos
- Realize simulações e treinamentos periódicos
- Documente fluxos de atendimento e scripts de resposta
- Use tags e categorias para facilitar relatórios

## Segurança e Privacidade
- Restrinja acesso ao painel por autenticação JWT e roles
- Registre logs de ações dos atendentes (quem fez o quê e quando)
- Oculte dados sensíveis conforme LGPD/GDPR
- Permita anonimização e exportação de dados sob demanda
- Implemente timeout de sessão e bloqueio após tentativas inválidas
- Audite acessos e alterações em conversas

## Exemplos de Payload
### Conversa
```json
{
  "conversationId": "uuid",
  "attendantId": "uuid",
  "status": "in_progress",
  "messages": [
    { "from": "user", "text": "Olá", "timestamp": "2025-08-08T12:00:00Z" },
    { "from": "bot", "text": "Como posso ajudar?", "timestamp": "2025-08-08T12:00:01Z" },
    { "from": "attendant", "text": "Boa tarde, posso ajudar?", "timestamp": "2025-08-08T12:00:05Z" }
  ],
  "notes": [
    { "author": "attendant", "text": "Cliente pediu segunda via.", "timestamp": "2025-08-08T12:01:00Z" }
  ]
}
```

### Atribuição de atendente
```json
{
  "attendantId": "uuid",
  "assignedBy": "admin",
  "assignedAt": "2025-08-08T12:00:10Z"
}
```

### Encerramento de conversa
```json
{
  "conversationId": "uuid",
  "closedBy": "attendant",
  "closedAt": "2025-08-08T12:10:00Z",
  "resolution": "Pedido finalizado com sucesso."
}
```

## Referências
- [Chatwoot](https://www.chatwoot.com/)
- [Arquitetura Omnichannel](https://en.wikipedia.org/wiki/Omnichannel)
- [Zendesk](https://www.zendesk.com/)
- [Freshdesk](https://freshdesk.com/)
- [LGPD](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)
