# Segurança e Produção

## HTTPS na Dashboard
Veja `Docs/HTTPS_DEPLOYMENT.md` para instruções de como proteger sua dashboard com HTTPS (Express nativo ou proxy reverso).

## Jobs de reenvio automáticos de eventos do Redis
O job `src/jobs/redisEventResender.js` faz o reenvio periódico de eventos não processados do Redis para a dashboard/API. Para ativar, basta importar e rodar esse arquivo junto ao servidor principal:

```js
// No seu entrypoint (ex: wppconnect-server.js)
require('./src/jobs/redisEventResender');
```

## Variáveis de ambiente
Veja o arquivo `.env.example` para todas as variáveis obrigatórias e recomendadas.

# Arquitetura NLP/IA Robusta


## Novos Recursos Avançados

- **Contexto multi-turno:** histórico de conversa do usuário é mantido e usado para respostas mais inteligentes.
- **Detecção automática de idioma** e **tradução**: o bot entende e responde em qualquer idioma.
- **Feedback do usuário:** API para registrar feedback sobre respostas de IA, ajudando no aprendizado contínuo.
- **Exportação de dados para Active Learning:** endpoint para exportar exemplos de mensagens, intenções, sentimentos e entidades para ajuste de modelos.
- **Personalização avançada:** preferências e recomendações automáticas por usuário, com endpoints REST.
- **Detecção de urgência e escalonamento:** identifica mensagens críticas e aciona alertas automáticos para equipe.
- **Análise de tópicos e tendências:** endpoint para identificar temas recorrentes nas conversas.
- **Monitoramento e alertas inteligentes:** alertas automáticos por e-mail para mensagens urgentes.
- **Consulta detalhada de contexto:** endpoint para consultar histórico/contexto completo de qualquer usuário.
- **Analytics e relatórios:** endpoints para consultar estatísticas de intenções, sentimentos e tópicos.
- **APIs para integração externa:** endpoints REST para feedback, analytics, exportação, personalização, recomendações e contexto.
- **Testes automatizados de NLP:** testes para garantir a qualidade dos fluxos inteligentes.

O bot agora conta com um módulo centralizado de NLP/IA (`src/services/nlpOrchestrator.js`) que oferece:

- **Entrada livre de texto/áudio** em qualquer ponto do fluxo
- **Detecção de intenção** usando IA (OpenAI, HuggingFace, Google, Azure)
- **Análise de sentimento** para priorização e monitoramento
- **Extração de entidades** (nome, endereço, pedido, etc.)
- **Geração de resposta automática** inteligente
- **Fallback automático** entre provedores de IA
- **Cache de intenções e resultados** para performance
- **Logs detalhados** para análise e melhoria contínua
- **Personalização e adaptação dinâmica** do fluxo


## Como funciona

Ao receber uma mensagem (texto ou áudio transcrito), o bot:
1. Processa a mensagem via `processNLP`, que orquestra todos os provedores disponíveis.
2. Detecta intenção, sentimento, entidades, tópicos e urgência, e gera resposta automática.
3. Usa fallback entre provedores em caso de falha.
4. Loga todos os eventos relevantes para análise posterior e aprendizado contínuo.
5. Permite personalização do atendimento conforme histórico, contexto, preferências e perfil do usuário.
6. Gera recomendações automáticas e aciona alertas em casos críticos.
7. Permite exportação de dados para ajuste de modelos e integração com sistemas externos.

## Configuração

Configure as chaves de API dos provedores no `.env`:
- `OPENAI_API_KEY`, `HUGGINGFACE_API_KEY`, `GOOGLE_NLP_API_KEY`, `AZURE_NLP_API_KEY`
- Defina a prioridade em `NLP_PROVIDER_PRIORITY`
- Ative/desative cache com `INTENT_CACHE_ENABLED`
- Configure alertas por e-mail: `ALERT_EMAIL`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_PASS`

Consulte o arquivo `src/services/nlpOrchestrator.js` para detalhes técnicos e customização.
Consulte os endpoints REST em `src/routes/` para integração externa, exportação, feedback, analytics, personalização, recomendações e contexto.
Consulte os testes automatizados em `tests/nlpTest.test.js`.
## Atendentes e Atendimento Humanizado

### Configuração dos Atendentes
Adicione os números dos atendentes no arquivo `.env`:

```
ATTENDANTS_NUMBERS=5511999999999,5511888888888
```

### Comandos para Atendentes
- `/assumir` — Atendente assume a conversa e pausa o bot para aquele cliente
- `/encerrar` — Atendente encerra o atendimento humanizado e o bot volta a responder

Esses comandos devem ser enviados pelo WhatsApp a partir do número do atendente cadastrado.

<div align="center">
  <img src="media/catalog-card.jpg" alt="Whatsapp Bot" width="180" />
  <h1>Whatsapp Bot</h1>
  <p><strong>Automação, IA, pedidos e atendimento via WhatsApp</strong></p>
  <a href="#funcionalidades"><img src="https://img.shields.io/badge/Node.js-%3E%3D16-green" /></a>
  <a href="#seguranca"><img src="https://img.shields.io/badge/Security-Robusto-blue" /></a>
  <a href="#testes"><img src="https://img.shields.io/badge/Testes-automatizados-brightgreen" /></a>
</div>

---

## Sumário
- [Funcionalidades](#funcionalidades)
- [Design & Arquitetura](#design--arquitetura)
- [Como Executar](#como-executar)
- [Documentação](#documentacao)
- [Licença](#licenca)

---

## Funcionalidades
✔️ Atendimento automatizado via WhatsApp<br>
✔️ Gerenciamento de pedidos e catálogo<br>
✔️ Integração com IA (OpenAI Whisper, GPT)<br>
✔️ Transcrição de áudio<br>
✔️ Controle de usuários, entregas e pagamentos<br>
✔️ Filas de mensagens e jobs assíncronos<br>
✔️ Logs detalhados, monitoramento e auditoria<br>

## Design & Arquitetura
<details>
  <summary>Estrutura do Projeto</summary>
  <ul>
    <li><code>src/</code> - Código principal</li>
    <li><code>database/</code> - Scripts e migrações</li>
    <li><code>media/</code> - Imagens e arquivos de mídia</li>
    <li><code>logs/</code> - Logs de eventos</li>
    <li><code>public/</code> - QR code, arquivos públicos</li>
    <li><code>Redis/</code> - Filas e cache</li>
    <li><code>tests/</code> - Testes automatizados</li>
  </ul>
</details>

## Como Executar
```sh
# 1. Configure as variáveis de ambiente (veja ENVIRONMENT.md)
# 2. Execute o Redis
Redis\redis-server.exe
# 3. Inicialize o banco de dados
pwsh scripts/init_db.ps1
# 4. Instale dependências
npm install
# 5. Inicie o bot
node wppconnect-server.js
```

## Documentação
| Documento | Descrição |
|-----------|-----------|
| [FLOW_DOC.md](./FLOW_DOC.md) | Fluxo de conversas |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura |
| [API_DOC.md](./API_DOC.md) | Endpoints da API |
| [DATABASE.md](./DATABASE.md) | Estrutura do banco |
| [SECURITY.md](./SECURITY.md) | Segurança |
| [QUEUE.md](./QUEUE.md) | Filas e processamento |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Integrações externas |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Variáveis de ambiente |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Como contribuir |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de mudanças |
| [TESTS.md](./TESTS.md) | Testes |
| [ROBUST_DESIGN.md](./ROBUST_DESIGN.md) | Design robusto |
| [USER_STATES.md](./USER_STATES.md) | Estados de usuário |
| [MEDIA.md](./MEDIA.md) | Gerenciamento de mídia |
| [LOGS.md](./LOGS.md) | Logs e monitoramento |

## Licença
MIT
