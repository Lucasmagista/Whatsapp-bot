const { initializeWhatsApp } = require('./src/services/whatsappService');
// wppconnect-server.js
// Servidor WhatsApp completo usando WPPConnect com fluxo conversacional robusto

const express = require('express');
const app = express();
app.use(express.json());
// Rotas REST para dashboard/admin
app.use('/admin', require('./src/routes/admin'));

// Definição da porta do servidor
const PORT = process.env.PORT || 3000;

const fs = require('fs');
const { Pool } = require('pg');
let Sentry;
try {
    Sentry = require('@sentry/node');
} catch (err) {
    // Sentry is optional; log the failure instead of silently ignoring it
    console.warn('Sentry not loaded (optional). Continuing without Sentry:', err?.message);
    Sentry = null;
}
const path = require('path');
const { create, Client } = require('@wppconnect-team/wppconnect');
// Import axios conditionally for optional NLP integration
let axios;
try {
    // axios is used for HTTP calls to third‑party NLP services (e.g. OpenAI)
    axios = require('axios');
} catch (err) {
    // axios não está disponível; classificação com serviço externo ficará indisponível
    console.warn('Axios not loaded (optional). Continuing without axios:', err?.message);
    axios = null;
}

// =========================
// Inicia o job de reenvio automático de eventos pendentes do Redis
try {
    require('./src/jobs/redisEventResender');
    console.log('Job de reenvio automático de eventos do Redis iniciado.');
} catch (e) {
    console.warn('Não foi possível iniciar o job de reenvio automático de eventos do Redis:', e.message);
}

// ...código existente...

// (depois de todas as configurações e definição de PORT)
// Inicialização do WhatsApp (com ou sem socket.io)
let io = null;
try {
    const http = require('http').createServer(app);
    io = require('socket.io')(http, { cors: { origin: '*' } });
    http.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
    // Inicializa WhatsApp (com io)
    initializeWhatsApp(io);
} catch (err) {
    // Se não usar socket.io, apenas inicie o app normalmente
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
    // Inicializa WhatsApp (sem io)
    initializeWhatsApp();
}
// UTILITÁRIOS DE CLASSIFICAÇÃO DE INTENÇÃO
// =========================
/**
 * Classifica a intenção de uma mensagem usando serviços externos ou heurística simples.
 * 1. Tenta serviço externo (OpenAI) se configurado.
 * 2. Fallback para heurísticas locais de palavras‑chave.
 * @param {string} text
 * @returns {Promise<{ intent: string | null }>}
 */
async function classifyIntent(text) {
    const normalized = (text || '').toLowerCase();
    
    // 1. Tentativa externa
    const externalIntent = await tryExternalIntent(normalized);
    if (externalIntent) {
        return { intent: externalIntent };
    }
    
    // 2. Heurísticas locais
    return { intent: classifyByHeuristics(normalized) };
}

/**
 * Chama o serviço externo (OpenAI) se disponível e retorna a intenção ou null.
 * Isola complexidade de rede/erros fora de classifyIntent.
 * @param {string} text
 * @returns {Promise<string|null>}
 */
async function tryExternalIntent(text) {
    const service = process.env.NLP_SERVICE;
    const canUseOpenAI =
        service &&
        service.toLowerCase() === 'openai' &&
        axios &&
        process.env.OPENAI_API_KEY;
    if (!canUseOpenAI) return null;
    
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        const endpoint = process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
        const systemPrompt =
            'Você é um classificador de intenções para um bot de WhatsApp de atendimento.\n' +
            'Classifique a mensagem do usuário em uma destas intenções: ' +
            'product_issue, invoice, purchase, faq_hours, faq_location, faq_payment, faq_delivery, faq_exchange, faq_other, human_support, end_conversation ou other.\n' +
            'Responda somente com um JSON contendo a propriedade "intent".';
        
        const response = await axios.post(
            endpoint,
            {
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                max_tokens: 16,
                temperature: 0
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`
                }
            }
        );
        
        const raw = response.data?.choices?.[0]?.message?.content?.trim();
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed?.intent || null;
        } catch {
            console.warn('Resposta de classificação não é JSON:', raw);
            return null;
        }
    } catch (err) {
        console.error('Erro ao classificar intenção via OpenAI:', err.message);
        return null;
    }
}

/**
 * Aplica heurísticas locais para determinar a intenção.
 * Reduz a complexidade substituindo cadeia de if/else por iteração sobre padrões.
 * @param {string} text
 * @returns {string|null}
 */
function classifyByHeuristics(text) {
    const patterns = [
        { intent: 'product_issue', regex: /(quebrado|defeito|produto|problema|garantia|manutenção)/ },
        { intent: 'invoice', regex: /(nota fiscal|nf|fatura|nota)/ },
        { intent: 'purchase', regex: /(comprar|compra|pedido|catálogo|catalogo|produto novo)/ },
        { intent: 'faq_hours', regex: /(horario|horários|dias|funcionamento)/ },
        { intent: 'faq_location', regex: /(onde|endereço|localização|loja)/ },
        { intent: 'faq_payment', regex: /(pagamento|formas|cartão|pix|dinheiro)/ },
        { intent: 'faq_delivery', regex: /(entrega|prazo|frete|envio)/ },
        { intent: 'faq_exchange', regex: /(troca|devolução|devolucao|garantia)/ },
        { intent: 'faq_other', regex: /(outro assunto|outros assuntos|outros|assuntos|dúvida geral)/ },
        { intent: 'human_support', regex: /(atendente|humano|pessoa|ajuda|suporte)/ },
        { intent: 'end_conversation', regex: /(encerrar|sair|fim|tchau|obrigado|obrigada)/ }
    ];
    for (const { intent, regex } of patterns) {
        if (regex.test(text)) return intent;
    }
    return null;
}

// Configurações iniciais
const UPLOAD_FOLDER = './uploads/';
const PDF_UPLOAD_FOLDER = './uploads/curriculos/';
const MEDIA_FOLDER = './media/';
const LOGS_FOLDER = './logs/';
const USER_STATE_DIR = path.join(__dirname, 'userStates');

// Inicializa Sentry para observabilidade (se fornecido)
if (Sentry && process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0')
    });
    // Middleware de request do Sentry
    app.use(Sentry.Handlers.requestHandler());
}

// Inicializa pool de conexão PostgreSQL se as variáveis de ambiente estiverem configuradas
let dbPool = null;
if (process.env.PGHOST || process.env.PGHOST || process.env.POSTGRES_HOST) {
    dbPool = new Pool({
        host: process.env.PGHOST || process.env.POSTGRES_HOST,
        port: process.env.PGPORT ? parseInt(process.env.PGPORT) : undefined,
        user: process.env.PGUSER || process.env.POSTGRES_USER,
        password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
        database: process.env.PGDATABASE || process.env.POSTGRES_DB,
        ssl: process.env.PGSSL ? { rejectUnauthorized: false } : undefined
    });
}

/**
 * Inicializa a estrutura de banco de dados necessária (se pool estiver presente).
 */
async function initializeDatabase() {
    if (!dbPool) return;
    try {
        await dbPool.query(
            'CREATE TABLE IF NOT EXISTS user_states (user_id TEXT PRIMARY KEY, state JSONB NOT NULL)'
        );
    } catch (err) {
        console.error('Erro ao inicializar tabela de user_states:', err.message);
        if (Sentry) Sentry.captureException(err);
    }
}

/**
 * Grava logs estruturados em formato JSONL (um JSON por linha) na pasta de logs. O
 * arquivo é rotacionado diariamente com base na data UTC. Se a pasta não existir,
 * tenta criar.
 * @param {string} event Nome do evento
 * @param {object} data Dados adicionais
 */
function structuredLog(event, data = {}) {
    try {
        const date = new Date().toISOString().split('T')[0];
        const filePath = path.join(LOGS_FOLDER, `${date}.jsonl`);
        const entry = {
            timestamp: new Date().toISOString(),
            event,
            ...data
        };
        // Garante que a pasta exista
        if (!fs.existsSync(LOGS_FOLDER)) fs.mkdirSync(LOGS_FOLDER, { recursive: true });
        fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
    } catch (err) {
        console.error('Erro ao gravar structured log:', err.message);
    }
}

/**
 * Escreve arquivo de forma segura com tentativas de retry. Útil para gravação de
 * anexos onde a operação de disco pode falhar temporariamente.
 * @param {string} filePath Caminho do arquivo a ser salvo
 * @param {Buffer|string} data Conteúdo a ser salvo
 * @param {object} options Opções do fs.writeFileSync (ex.: { encoding: 'base64' })
 * @param {number} retries Quantidade de tentativas
 * @returns {Promise<boolean>} Verdadeiro se gravado com sucesso
 */
async function safeWriteFile(filePath, data, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            fs.writeFileSync(filePath, data, options);
            return true;
        } catch (err) {
            if (i === retries - 1) {
                console.error('Falha ao gravar arquivo:', err.message);
                if (Sentry) Sentry.captureException(err);
                throw err;
            }
        }
    }
    return false;
}

// Criar diretórios necessários
[UPLOAD_FOLDER, PDF_UPLOAD_FOLDER, MEDIA_FOLDER, LOGS_FOLDER, USER_STATE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// =========================
// FILA DE ATENDIMENTO HUMANO
// =========================
// Manter uma fila global para usuários aguardando atendimento humano.
// Ao inserir novos usuários, verifique se não estão duplicados. O uso de
// global permite que a fila seja compartilhada entre diferentes chamadas.
global.humanQueue = global.humanQueue || [];

// =========================
// EVENTOS SSE PARA DASHBOARD
// =========================
// Lista de clientes conectados via Server-Sent Events (EventSource)
global.sseClients = global.sseClients || [];

/**
 * Envia um evento SSE para todos os clientes conectados.
 * @param {string} event Nome do evento
 * @param {object} data  Dados serializados
 */
function broadcastEvent(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    (global.sseClients || []).forEach(client => {
        try {
            client.res.write(payload);
        } catch (err) {
            // Marca cliente como desconectado e registra o erro para depuração
            client.connected = false;
            // Loga o erro diretamente (sem capturar silenciosamente)
            console.warn('Erro ao enviar evento SSE para cliente:', err && err.message ? err.message : err);
        }
    });
    // Limpa clientes desconectados
    global.sseClients = (global.sseClients || []).filter(c => c.connected !== false);
}


// =========================
// CLASSE COMPLETA DE FLUXO CONVERSACIONAL
// =========================
class ConversationFlow {
    
    // =========================
    // PROCESSAMENTO PRINCIPAL DE MENSAGENS
    // =========================
    static async processMessage(message, userState) {
        // Verifica se a mensagem recebida é resultado de uma interação (botões ou listas)
        // Em mensagens interativas, o texto exibido ao usuário nem sempre corresponde à opção selecionada,
        // pois o valor real fica armazenado em propriedades como selectedButtonId ou selectedRowId.
        // Para garantir que as opções sejam tratadas corretamente em todo o fluxo, sobrescrevemos
        // message.body com o identificador da opção selecionada quando existir.
        try {
            const interactivePayload =
                message.selectedButtonId ||
                message.selectedRowId ||
                (message.buttonResponse && (message.buttonResponse.id || message.buttonResponse.text || message.buttonResponse.title)) ||
                (message.listResponse && (message.listResponse.rowId || message.listResponse.title)) ||
                null;
            if (interactivePayload) {
                // Substitui o corpo da mensagem pelo identificador selecionado
                message.body = String(interactivePayload).trim();
            }
        } catch (err) {
            // Em caso de erro na extração do payload interativo, ignoramos e prosseguimos com o corpo original
            console.warn('Erro ao processar payload interativo:', err);
        }

        const messageBody = message.body?.toLowerCase()?.trim() || '';
        const normalizedBody = this.normalizeText(messageBody);
        const currentStep = userState?.step || 'start';
        // Verifica se o usuário expressou confusão e deseja que a última resposta seja repetida
        const confusionTerms = ['?', 'nao entendi', 'não entendi', 'nao entendi nada', 'não entendi nada', 'nao entendo', 'não entendo', 'nao entendeu', 'não entendeu'];
        if (confusionTerms.includes(normalizedBody)) {
            const last = userState?.data?.lastBotResponse;
            if (last) {
                structuredLog('repeat_last_response', { chatId: message.from, requested: message.body });
                return { response: last, newStep: currentStep, data: userState.data };
            }
        }

        // Se for áudio, faz transcrição e análise
        if (message.hasMedia && message.type === 'audio' && currentStep !== 'in_human_chat') {
            return await this.handleAudioMessage(message, userState);
        }

        // Detecta payload do catálogo web
        if (messageBody.startsWith('pedido via site:')) {
            const pedidoDetalhes = message.body.substring('pedido via site:'.length).trim();
            return {
                response: '🛒 Recebemos seu pedido do site! Para finalizar, por favor informe seu *nome completo*:',
                newStep: 'purchase_catalog_awaiting_name',
                data: {
                    ...userState?.data,
                    catalogOrderPayload: pedidoDetalhes
                }
            };
        }

        // Encaminha para fluxo de compra via catálogo
        if (currentStep?.startsWith('purchase_catalog_')) {
            return await this.handlePurchaseCatalog(message, userState);
        }

        console.log(`🔄 Processando fluxo - Usuário: ${message.from}, Passo: ${currentStep}, Mensagem: "${messageBody}"`);
        
        switch (currentStep) {
            case 'start':
                return this.handleStart(message);
            
            case 'awaiting_name':
                return this.handleName(message, userState);
            
            case 'awaiting_main_option':
                return await this.handleMainMenu(message, userState, normalizedBody);
            
            // Fluxo de currículo
            case 'awaiting_curriculo_pdf':
            case 'curriculo_ask_channel':
            case 'curriculo_ask_channel_outro':
            case 'awaiting_curriculo_pdf_file':
            case 'curriculo_post_answer':
                return await this.handleCurriculo(message, userState);
            
            // Fluxo de atendimento humano
            case 'in_human_chat':
                return this.handleHumanChat(message, userState);
            
            // Submenu de dúvidas
            case 'faq_menu':
                return this.handleFaqMenu(message, userState);
            
            case 'faq_post_answer':
                return this.handleFaqPostAnswer(message, userState);
            
            // Fluxo robusto de compra
            case 'purchase_ask_catalog':
            case 'purchase_ask_city':
            case 'purchase_choose_channel':
            case 'purchase_product_name_robust':
            case 'purchase_quantity_robust':
            case 'purchase_questions_robust':
            case 'purchase_confirm_order_robust':
            case 'purchase_ask_name_robust':
            case 'purchase_ask_address_robust':
            case 'purchase_ask_payment_robust':
            case 'purchase_pix_choose_when':
            case 'purchase_awaiting_pix_proof_robust':
            case 'purchase_notify_attendant_robust':
                return await this.handlePurchaseRobust(message, userState);
            
            // Fluxo de problema com produto
            case 'product_issue_nf':
            case 'product_issue_photo':
            case 'product_issue_box_photo':
            case 'product_issue_label_photo':
            case 'product_issue_address':
            case 'product_issue_comments':
                return this.handleProductIssue(message, userState);
            
            // Fluxo de compra tradicional
            case 'purchase_product_name':
            case 'purchase_product_link':
            case 'purchase_product_photo':
            case 'purchase_quantity':
            case 'purchase_questions':
                return await this.handlePurchase(message, userState);
            
            // Fluxo de carrinho
            case 'cart_start':
            case 'cart_add_product':
            case 'cart_ask_product_name':
            case 'cart_ask_product_qty':
            case 'cart_remove_item':
            case 'cart_edit_item':
            case 'cart_edit_qty':
            case 'cart_menu':
            case 'cart_ask_name':
            case 'cart_ask_address':
                return await this.handleCartFlow(message, userState);
            
            // Satisfação
            case 'awaiting_satisfaction_rating':
            case 'awaiting_satisfaction_feedback':
                return this.handleSatisfaction(message, userState);
            
            case 'transfer_to_human':
                return this.handleHumanTransfer(message, userState);
            
            default:
                return this.handleStart(message);
        }
    }
    
    // =========================
    // HANDLERS DE FLUXO ESPECÍFICOS
    // =========================
    
    static normalizeText(text) {
        // Normaliza texto removendo acentos, emojis e caracteres especiais.
        // Isso melhora o mapeamento de palavras-chave e evita falhas quando o usuário
        // seleciona uma opção com emoji no título.
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            // Remove caracteres que não sejam letras, números ou espaço.
            // Inclui emojis e outros símbolos no filtro.
            .replace(/[^a-z0-9\s]/g, '')
            .trim();
    }
    
    static handleStart(message) {
        const messageBody = this.normalizeText(message.body);
        
        // Se usuário disse "oi", reiniciar conversa
        if (messageBody === 'oi' || messageBody === 'ola' || messageBody === 'inicio' || messageBody === 'reinciar') {
            return {
                response: '🏠 *Inaugura Lar - Atendimento Especializado* 🏠\n\nOlá! 👋 Seja bem-vindo(a) ao nosso canal de atendimento. Estamos aqui para resolver seu problema com agilidade e qualidade.\n\nPara iniciarmos o atendimento personalizado, por favor informe:\n\n*Nome completo:*',
                newStep: 'awaiting_name',
                data: {}
            };
        }
        
        // Primeira mensagem
        return {
            response: '🏠 *Inaugura Lar - Atendimento Especializado* 🏠\n\nOlá! 👋 Seja bem-vindo(a) ao nosso canal de atendimento. Estamos aqui para resolver seu problema com agilidade e qualidade.\n\nPara iniciarmos o atendimento personalizado, por favor informe:\n\n*Nome completo:*',
            newStep: 'awaiting_name',
            data: {}
        };
    }
    
    static handleName(message, userState) {
        const messageBody = message.body?.trim() || '';
        const nameParts = messageBody.split(' ').filter(part => part.length > 0);
        
        // Validar nome (pelo menos duas palavras)
        if (nameParts.length < 2) {
            return {
                response: '⚠️ Por favor, informe seu *nome completo* (pelo menos duas palavras) para prosseguirmos.',
                newStep: 'awaiting_name',
                data: userState?.data || {}
            };
        }
        
        // Nome válido
        const firstName = nameParts[0];
        const fullName = messageBody;
        
        return {
            response: `👋 Olá, *${firstName}*!\n\nComo podemos ajudar você hoje?`,
            newStep: 'awaiting_main_option',
            data: {
                ...(userState?.data || {}),
                name: fullName,
                firstName: firstName
            },
            buttons: [
                { id: '1', text: '🛠️ Problema com produto' },
                { id: '2', text: '📄 Nota Fiscal' },
                { id: '3', text: '💳 Fazer uma compra' },
                { id: '4', text: '❓ Dúvidas Frequentes' },
                { id: '5', text: '📄 Enviar Currículo' },
                { id: '6', text: 'Encerrar conversa' }
            ]
        };
    }
    
    static async handleMainMenu(message, userState, normalizedBody) {
        const keywordMapping = {
            '1': 'product_issue',
            'problema': 'product_issue',
            'defeito': 'product_issue',
            'quebrado': 'product_issue',
            'suporte': 'product_issue',
            '2': 'invoice',
            'nota fiscal': 'invoice',
            // Permite que "nota" sozinho também mapeie para invoice (nota fiscal)
            'nota': 'invoice',
            'fatura': 'invoice',
            'nf': 'invoice',
            '3': 'purchase',
            'compra': 'purchase',
            'comprar': 'purchase',
            'fazer uma compra': 'purchase',
            '4': 'faq',
            'duvida': 'faq',
            'dúvida': 'faq',
            'duvidas': 'faq',
            'dúvidas': 'faq',
            'faq': 'faq',
            'pergunta': 'faq',
            'perguntas': 'faq',
            'atendente': 'support',
            'humano': 'support',
            'pessoa': 'support',
            'falar': 'support',
            '5': 'curriculo',
            'curriculo': 'curriculo',
            'currículo': 'curriculo',
            'trabalho': 'curriculo',
            'vaga': 'curriculo',
            'emprego': 'curriculo',
            'trabalhe': 'curriculo',
            'enviar curriculo': 'curriculo',
            'enviar currículo': 'curriculo',
            '6': 'end_conversation',
            'encerrar': 'end_conversation',
            'encerrar conversa': 'end_conversation',
            'fim': 'end_conversation',
            'finalizar': 'end_conversation',
            'sair': 'end_conversation',
            'tchau': 'end_conversation',
            'obrigado': 'end_conversation',
            'obrigada': 'end_conversation'
        };
        
        const action = keywordMapping[normalizedBody] || keywordMapping[normalizedBody.split(' ')[0]];
        
        if (action === 'end_conversation') {
            return {
                response: '🙏 *Obrigado por conversar conosco!*\n\nFoi um prazer ajudar você hoje. Se precisar de algo no futuro, estaremos sempre aqui!\n\n✨ Até mais! 👋',
                newStep: 'start',
                finalizeSession: true,
                data: userState.data
            };
        }
        
        if (action === 'curriculo') {
            return {
                response: 'Antes de continuarmos, por onde você ficou sabendo das nossas vagas?',
                newStep: 'curriculo_ask_channel',
                data: { ...userState.data, curriculoChannelAsked: true },
                buttons: [
                    { id: '1', text: 'Facebook' },
                    { id: '2', text: 'Instagram' },
                    { id: '3', text: 'WhatsApp' },
                    { id: '4', text: 'Amigos e Familiares' },
                    { id: '5', text: 'Outro' }
                ]
            };
        }
        
        if (action === 'purchase') {
            return {
                response: `Você já conhece nosso catálogo digital?`,
                newStep: 'purchase_ask_catalog',
                data: {
                    ...userState.data,
                    flowType: 'purchase_robust'
                },
                buttons: [
                    { id: '1', text: 'Quero ver o catálogo online' },
                    { id: '2', text: 'Continuar comprando pelo WhatsApp' }
                ]
            };
        }
        
        if (action === 'faq') {
            return {
                response: '❓ *Dúvidas Frequentes*\n\nComo posso te ajudar? Escolha uma opção:',
                newStep: 'faq_menu',
                data: userState.data,
                buttons: [
                    { id: '1', text: '🕒 Horário e dias de funcionamento' },
                    { id: '2', text: '📍 Onde fica a loja?' },
                    { id: '3', text: '💳 Formas de pagamento' },
                    { id: '4', text: '🚚 Entregas e prazos' },
                    { id: '5', text: '🔄 Trocas e devoluções' },
                    { id: '6', text: '📞 Outros assuntos' },
                    { id: '7', text: 'Encerrar conversa' }
                ]
            };
        }
        
        if (action === 'product_issue') {
            return {
                response: '📋 *Registro de Problema com Produto*\n\nPara agilizar seu atendimento, por favor envie:\n\n1️⃣ *Nota fiscal ou número do pedido*\n(Você pode enviar uma foto da nota fiscal ou apenas digitar o número).',
                newStep: 'product_issue_nf',
                data: {
                    ...userState.data,
                    flowType: 'product_issue'
                }
            };
        }
        
        if (action === 'invoice') {
            return {
                response: "🧾 A funcionalidade de 'Nota Fiscal' está em desenvolvimento. Por favor, escolha outra opção.\n\n*1*. 🛠️ Problema com produto\n*2*. 🧾 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes",
                newStep: 'awaiting_main_option',
                data: userState.data
            };
        }
        
        if (action === 'support') {
            // Adiciona o usuário à fila global se ainda não estiver nela
            const chatId = message.from;
            if (!global.humanQueue.includes(chatId)) {
                global.humanQueue.push(chatId);
                // Atualiza métrica de entrada na fila
                userState.data = userState.data || {};
                userState.data.metrics = userState.data.metrics || {};
                userState.data.metrics.queueEnterTime = new Date().toISOString();
                // Notifica dashboard
                broadcastEvent('queue:join', { chatId, position: global.humanQueue.indexOf(chatId) + 1, name: userState.data?.name || userState.data?.firstName || null, timestamp: new Date().toISOString() });
            }
            const queuePosition = global.humanQueue.indexOf(chatId) + 1;
            return {
                response: `👨‍💼 *Solicitação de Atendimento*\n\nSua solicitação foi registrada com sucesso!\n\n⏳ *Todos os nossos atendentes estão ocupados no momento.*\nVocê foi adicionado à fila de atendimento. Posição: *${queuePosition}*.\n\n*Atenção:* caso deseje cancelar, digite *sair*.\nAguarde, em breve um atendente estará com você!`,
                newStep: 'transfer_to_human',
                data: {
                    ...userState.data,
                    queuePosition: queuePosition,
                    flowType: 'human_support'
                }
            };
        }
        
        // Se não encontrou ação diretamente, tenta classificar a intenção da mensagem usando NLP ou heurística
        try {
            const classification = await classifyIntent(normalizedBody);
            const intent = classification?.intent;
            if (intent) {
                switch (intent) {
                    case 'product_issue': {
                        return {
                            response: '📋 *Registro de Problema com Produto*\n\nPara agilizar seu atendimento, por favor envie:\n\n1️⃣ *Nota fiscal ou número do pedido*\n(Você pode enviar uma foto da nota fiscal ou apenas digitar o número).',
                            newStep: 'product_issue_nf',
                            data: {
                                ...userState.data,
                                flowType: 'product_issue'
                            }
                        };
                    }
                    case 'invoice': {
                        return {
                            response: "🧾 A funcionalidade de 'Nota Fiscal' está em desenvolvimento. Por favor, escolha outra opção.\n\n*1*. 🛠️ Problema com produto\n*2*. 🧾 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes",
                            newStep: 'awaiting_main_option',
                            data: userState.data
                        };
                    }
                    case 'purchase': {
                        return {
                            response: `Você já conhece nosso catálogo digital?`,
                            newStep: 'purchase_ask_catalog',
                            data: {
                                ...userState.data,
                                flowType: 'purchase_robust'
                            },
                            buttons: [
                                { id: '1', text: 'Quero ver o catálogo online' },
                                { id: '2', text: 'Continuar comprando pelo WhatsApp' }
                            ]
                        };
                    }
                    // Mapeia intents de FAQ para a escolha de menu apropriada
                    case 'faq_hours':
                    case 'faq_location':
                    case 'faq_payment':
                    case 'faq_delivery':
                    case 'faq_exchange':
                    case 'faq_other':
                    {
                        // Define qual opção representa cada sub-intent
                        const faqMap = {
                            'faq_hours': '1',
                            'faq_location': '2',
                            'faq_payment': '3',
                            'faq_delivery': '4',
                            'faq_exchange': '5',
                            'faq_other': '6'
                        };
                        const mappedOption = faqMap[intent] || '1';
                        // Cria um pseudo-message para reusar handleFaqMenu
                        const fakeMessage = { ...message, body: mappedOption };
                        return this.handleFaqMenu(fakeMessage, userState);
                    }
                    case 'human_support': {
                        // Executa a mesma lógica de suporte humano
                        const chatId = message.from;
                        if (!global.humanQueue.includes(chatId)) {
                            global.humanQueue.push(chatId);
                            userState.data = userState.data || {};
                            userState.data.metrics = userState.data.metrics || {};
                            userState.data.metrics.queueEnterTime = new Date().toISOString();
                            broadcastEvent('queue:join', { chatId, position: global.humanQueue.indexOf(chatId) + 1, name: userState.data?.name || userState.data?.firstName || null, timestamp: new Date().toISOString() });
                        }
                        const queuePosition = global.humanQueue.indexOf(chatId) + 1;
                        return {
                            response: `👨‍💼 *Solicitação de Atendimento*\n\nSua solicitação foi registrada com sucesso!\n\n⏳ *Todos os nossos atendentes estão ocupados no momento.*\nVocê foi adicionado à fila de atendimento. Posição: *${queuePosition}*.\n\n*Atenção:* caso deseje cancelar, digite *sair*.\nAguarde, em breve um atendente estará com você!`,
                            newStep: 'transfer_to_human',
                            data: {
                                ...userState.data,
                                queuePosition: queuePosition,
                                flowType: 'human_support'
                            }
                        };
                    }
                    case 'end_conversation': {
                        return {
                            response: '🙏 *Obrigado por conversar conosco!*\n\nFoi um prazer ajudar você hoje. Se precisar de algo no futuro, estaremos sempre aqui!\n\n✨ Até mais! 👋',
                            newStep: 'start',
                            finalizeSession: true,
                            data: userState.data
                        };
                    }
                    default:
                        break;
                }
            }
        } catch (err) {
            console.error('Erro ao classificar intenção:', err.message);
        }
        // Default: opção inválida
        return {
            response: `❌ Opção inválida. Por favor, escolha uma das opções do menu:\n\n*1*. 🛠️ Problema com produto\n*2*. 🧾 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes\n*5*. 📄 Enviar Currículo\n*6*. Encerrar conversa\n\nResponda com o *número* ou *palavra-chave* da opção desejada.`,
            newStep: 'awaiting_main_option',
            data: userState.data,
            buttons: [
                { id: '1', text: '🛠️ Problema com produto' },
                { id: '2', text: '📄 Nota Fiscal' },
                { id: '3', text: '💳 Fazer uma compra' },
                { id: '4', text: '❓ Dúvidas Frequentes' },
                { id: '5', text: '📄 Enviar Currículo' },
                { id: '6', text: 'Encerrar conversa' }
            ]
        };
    }

    // =========================
    // FLUXO DE FAQ
    // =========================
    static handleFaqMenu(message, userState) {
        // Normaliza a resposta para evitar problemas com acentos, emojis e maiúsculas
        const raw = (message.body || '').trim();
        const answer = this.normalizeText(raw);
        const answerLower = answer.toLowerCase();
        const env = process.env;
        
        // Se o usuário digitar "menu" ou "voltar", retorna ao menu principal
        if (['menu', 'voltar'].includes(answerLower)) {
            return {
                response: `👋 Olá, *${userState.data.firstName}*!\n\nComo podemos ajudar você hoje?\n\n*1*. 🛠️ Problema com produto\n*2*. 📄 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes\n*5*. 📄 Enviar Currículo\n*6*. Encerrar conversa\n\nResponda com o *número* ou *palavra-chave* da opção desejada.`,
                newStep: 'awaiting_main_option',
                data: userState.data
            };
        }
        
        // Mapeia a resposta para uma chave de ação. Permitimos tanto números quanto palavras-chave.
        const faqMapping = {
            '1': '1',
            'horario': '1',
            'horarios': '1',
            'dias': '1',
            'funcionamento': '1',
            '2': '2',
            'onde': '2',
            'endereco': '2',
            'localizacao': '2',
            'loja': '2',
            '3': '3',
            'forma': '3',
            'formas': '3',
            'pagamento': '3',
            'pagamentos': '3',
            '4': '4',
            'entrega': '4',
            'entregas': '4',
            'prazo': '4',
            'prazos': '4',
            '5': '5',
            'troca': '5',
            'trocas': '5',
            'devolucao': '5',
            'devolucoes': '5',
            '6': '6',
            'outros': '6',
            'assuntos': '6',
            'outros assuntos': '6',
            '7': '7',
            'encerrar': '7',
            'fim': '7',
            'sair': '7'
        };
        // Obtém a primeira palavra normalizada para tratar frases longas
        const firstWord = answer.split(' ')[0];
        const mapped = faqMapping[answer] || faqMapping[firstWord];

        switch (mapped) {
            case '1': {
                const horario = env.BUSINESS_HOURS || 'Seg a Sex: 08:00 às 18:00\nSábado: 08:00 às 12:00\nDomingo: Fechado';
                const dias = env.BUSINESS_DAYS || 'Segunda a Sábado';
                return {
                    response: `🕒 *Horário e Dias de Funcionamento*\n\n${horario}\n${dias}\n\n✨ Posso ajudar com mais alguma coisa?`,
                    newStep: 'faq_post_answer',
                    data: userState.data,
                    buttons: [
                        { id: '1', text: 'Sim, tenho outra dúvida' },
                        { id: '2', text: 'Não, obrigado(a)' }
                    ]
                };
            }
            case '2': {
                const endereco = env.STORE_ADDRESS || 'Endereço não cadastrado.';
                const latitude = env.STORE_LATITUDE;
                const longitude = env.STORE_LONGITUDE;
                let response = `🏪 *Endereço da Loja*\n\n${endereco}`;
                if (latitude && longitude) {
                    response += `\n\n📍 Localização: https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                }
                return {
                    response: response + '\n\n✨ Posso ajudar com mais alguma coisa?',
                    newStep: 'faq_post_answer',
                    data: userState.data,
                    buttons: [
                        { id: '1', text: 'Sim, tenho outra dúvida' },
                        { id: '2', text: 'Não, obrigado(a)' }
                    ]
                };
            }
            case '3': {
                const presencial = env.PAYMENT_PRESENCIAL || 'PIX, Cartão de Crédito/Débito, Dinheiro';
                const online = env.PAYMENT_ONLINE || 'PIX, Cartão (conforme plataforma), Mercado Pago';
                return {
                    response: `💳 *Formas de Pagamento*\n\n• *Presencial:* ${presencial}\n• *Online:* ${online}\n\n✨ Posso ajudar com mais alguma coisa?`,
                    newStep: 'faq_post_answer',
                    data: userState.data,
                    buttons: [
                        { id: '1', text: 'Sim, tenho outra dúvida' },
                        { id: '2', text: 'Não, obrigado(a)' }
                    ]
                };
            }
            case '4': {
                const entrega = env.DELIVERY_INFO || 'Entregamos em toda a cidade e região. Prazo médio: 1 a 3 dias úteis após confirmação do pagamento.';
                return {
                    response: `🚚 *Entregas e Prazos*\n\n${entrega}\n\n✨ Posso ajudar com mais alguma coisa?`,
                    newStep: 'faq_post_answer',
                    data: userState.data,
                    buttons: [
                        { id: '1', text: 'Sim, tenho outra dúvida' },
                        { id: '2', text: 'Não, obrigado(a)' }
                    ]
                };
            }
            case '5': {
                const trocas = env.EXCHANGE_POLICY || 'Aceitamos trocas e devoluções em até 7 dias após o recebimento, conforme o CDC. Fale com um atendente para iniciar o processo.';
                return {
                    response: `🔄 *Trocas e Devoluções*\n\n${trocas}\n\n✨ Posso ajudar com mais alguma coisa?`,
                    newStep: 'faq_post_answer',
                    data: userState.data,
                    buttons: [
                        { id: '1', text: 'Sim, tenho outra dúvida' },
                        { id: '2', text: 'Não, obrigado(a)' }
                    ]
                };
            }
            case '6': {
                const contato = env.CONTACT_INFO || 'Telefone/WhatsApp: (00) 00000-0000\nEmail: contato@empresa.com';
                return {
                    response: `📞 *Outros Assuntos*\n\nEntre em contato conosco:\n${contato}\n\n✨ Posso ajudar com mais alguma coisa?`,
                    newStep: 'faq_post_answer',
                    data: userState.data,
                    buttons: [
                        { id: '1', text: 'Sim, tenho outra dúvida' },
                        { id: '2', text: 'Não, obrigado(a)' }
                    ]
                };
            }
            case '7': {
                return {
                    response: '🙏 *Obrigado por conversar conosco!*\n\nFoi um prazer ajudar você hoje. Se precisar de algo no futuro, estaremos sempre aqui!\n\n✨ Até mais! 👋',
                    newStep: 'start',
                    finalizeSession: true,
                    data: userState.data
                };
            }
            default:
                return {
                    response: '❓ Opção inválida. Por favor, escolha uma das dúvidas do menu (1-7) ou digite *menu* para voltar ao menu principal.',
                    newStep: 'faq_menu',
                    data: userState.data
                };
        }
    }

    static handleFaqPostAnswer(message, userState) {
        // Normaliza a resposta
        const raw = (message.body || '').trim();
        const answer = this.normalizeText(raw);
        const faqButtons = [
            { id: '1', text: 'Sim, tenho outra dúvida' },
            { id: '2', text: 'Não, obrigado(a)' }
        ];

        // Verifica se quer mais dúvidas
        if (answer === '1' || answer === 'sim' || answer === 's' || answer === 'si' || answer === 'simtenhooutraduvida') {
            // Volta para o menu principal
            return {
                response: `👋 Olá, *${userState.data.firstName}*!\n\nComo podemos ajudar você hoje?\n\n*1*. 🛠️ Problema com produto\n*2*. 📄 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes\n*5*. 📄 Enviar Currículo\n*6*. Encerrar conversa\n\nResponda com o *número* ou *palavra-chave* da opção desejada.`,
                newStep: 'awaiting_main_option',
                data: userState.data,
                buttons: faqButtons
            };
        }

        // Finaliza atendimento
        if (answer === '2' || answer === 'nao' || answer === 'n' || answer === 'não') {
            return {
                response: '🙏 *Obrigado por conversar conosco!*\n\nFoi um prazer ajudar você hoje. Se precisar de algo no futuro, estaremos sempre aqui!\n\n✨ Até mais! 👋',
                newStep: 'start',
                finalizeSession: true,
                data: userState.data,
                buttons: faqButtons
            };
        }

        // Resposta inválida
        return {
            response: '⚠️ Por favor, responda com:\n\n*1* - Se deseja mais alguma coisa\n*2* - Se não precisa de mais nada\n\nOu use as palavras *sim* ou *não*:',
            newStep: 'faq_post_answer',
            data: userState.data,
            buttons: faqButtons
        };
    }

    // =========================
    // FLUXO DE CURRÍCULO
    // =========================
    static async handleCurriculo(message, userState) {
        const step = userState.step;
        const data = userState.data || {};
        const bodyRaw = message.body?.trim() || '';
        const body = this.normalizeText(bodyRaw);

        // 1. Perguntar canal (Facebook, Instagram, etc.)
        if (step === 'curriculo_ask_channel') {
            const answer = body;
            let channel = null;
            if (answer.includes('1') || answer.includes('facebook')) channel = 'Facebook';
            else if (answer.includes('2') || answer.includes('instagram')) channel = 'Instagram';
            else if (answer.includes('3') || answer.includes('whatsapp')) channel = 'WhatsApp';
            else if (answer.includes('4') || answer.includes('amigos') || answer.includes('familiares')) channel = 'Amigos e Familiares';
            else if (answer.includes('5') || answer.includes('outro')) channel = 'Outro';
            if (!channel) {
                return {
                    response: 'Por favor, responda com: Facebook, Instagram, WhatsApp, Amigos e Familiares ou Outro.',
                    newStep: 'curriculo_ask_channel',
                    data,
                    buttons: [
                        { id: '1', text: 'Facebook' },
                        { id: '2', text: 'Instagram' },
                        { id: '3', text: 'WhatsApp' },
                        { id: '4', text: 'Amigos e Familiares' },
                        { id: '5', text: 'Outro' }
                    ]
                };
            }
            if (channel === 'Outro') {
                data.curriculoChannel = 'Outro';
                return {
                    response: 'Por favor, escreva por onde você ficou sabendo das nossas vagas:',
                    newStep: 'curriculo_ask_channel_outro',
                    data
                };
            }
            data.curriculoChannel = channel;
            return {
                response: 'Ótimo! Agora, por favor, envie seu currículo em PDF (anexe o arquivo nesta conversa).\n\nCaso não tenha em PDF, pode enviar uma foto (imagem) do seu currículo.',
                newStep: 'awaiting_curriculo_pdf_file',
                data
            };
        }
        
        // 2. Tratar resposta do campo "Outro"
        if (step === 'curriculo_ask_channel_outro') {
            if (!body || body.length < 2) {
                return {
                    response: 'Por favor, escreva por onde você ficou sabendo das nossas vagas:',
                    newStep: 'curriculo_ask_channel_outro',
                    data
                };
            }
            data.curriculoChannel = body;
            return {
                response: 'Obrigado por informar! Agora vamos continuar com o processo de envio do seu currículo. Por favor, envie seu currículo em PDF.\n\nCaso não tenha em PDF, pode enviar uma foto (imagem) do seu currículo.',
                newStep: 'awaiting_curriculo_pdf_file',
                data
            };
        }
        
        // 3. Receber o PDF ou imagem
        if (step === 'awaiting_curriculo_pdf_file') {
            // Se for anexo normal (mídia)
            if (message.hasMedia) {
                const media = await message.downloadMedia();
                // Validação de tipo permitido
                const mimetype = media?.mimetype || '';
                const allowedTypes = [
                    'application/pdf',
                    'image/jpeg',
                    'image/png',
                    'image/jpg',
                    'image/gif'
                ];
                const isAllowed = allowedTypes.some((type) => mimetype.includes(type));
                if (!isAllowed) {
                    return {
                        response: '⚠️ O arquivo enviado não é um PDF ou imagem suportada. Por favor, envie seu currículo em PDF ou como imagem (JPEG/PNG/GIF).',
                        newStep: 'awaiting_curriculo_pdf_file',
                        data
                    };
                }
                // Validação de tamanho (5MB por padrão ou conforme variável de ambiente)
                const maxSize = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880');
                let sizeBytes = 0;
                if (typeof media.data === 'string') {
                    // base64 string -> calcula tamanho
                    sizeBytes = Buffer.from(media.data, 'base64').length;
                } else if (Buffer.isBuffer(media.data)) {
                    sizeBytes = media.data.length;
                }
                if (sizeBytes > maxSize) {
                    return {
                        response: `⚠️ O arquivo é muito grande. Envie um arquivo com no máximo ${Math.round(maxSize / 1024 / 1024)}MB.`,
                        newStep: 'awaiting_curriculo_pdf_file',
                        data
                    };
                }
                // Determine extensão
                const isPDF = mimetype.includes('pdf');
                const isImage = mimetype.startsWith('image/');
                const ext = isPDF ? 'pdf' : (mimetype.split('/')[1] || 'jpg');
                const fileName = `curriculo_${message.from}_${Date.now()}.${ext}`;
                const filePath = path.join(PDF_UPLOAD_FOLDER, fileName);
                try {
                    // Salva com segurança com retries
                    if (isPDF) {
                        let buffer;
                        if (typeof media.data === 'string') {
                            buffer = Buffer.from(media.data, 'base64');
                        } else if (Buffer.isBuffer(media.data)) {
                            buffer = media.data;
                        } else {
                            buffer = Buffer.from(media.data, 'base64');
                        }
                        await safeWriteFile(filePath, buffer);
                    } else if (isImage) {
                        // Converte base64 string para buffer
                        let buffer;
                        if (typeof media.data === 'string') {
                            buffer = Buffer.from(media.data, 'base64');
                        } else if (Buffer.isBuffer(media.data)) {
                            buffer = media.data;
                        } else {
                            buffer = Buffer.from(media.data, 'base64');
                        }
                        await safeWriteFile(filePath, buffer);
                    }
                    structuredLog('curriculo_received', {
                        from: message.from,
                        fileName,
                        filePath,
                        channel: data.curriculoChannel,
                        sizeBytes
                    });
                } catch (e) {
                    console.error('Erro ao salvar currículo:', e.message);
                    structuredLog('curriculo_save_error', { from: message.from, error: e.message });
                    return {
                        response: '❌ Erro ao salvar o arquivo. Por favor, tente novamente.',
                        newStep: 'awaiting_curriculo_pdf_file',
                        data
                    };
                }
                return {
                    response: '✅ Currículo recebido com sucesso! Muito obrigado pelo interesse! Nossa equipe irá analisar seu perfil e, caso haja compatibilidade, entraremos em contato.\n\nPosso te ajudar com mais alguma coisa?\n\n*1* - Sim\n*2* - Não',
                    newStep: 'curriculo_post_answer',
                    data: data,
                    finalizeSession: false
                };
            }
            // Se o usuário enviou base64 da imagem no corpo da mensagem
            const base64Pattern = /^(\/9j\/|data:image\/(jpeg|png|jpg|gif);base64,)/;
            if (message.body && base64Pattern.test(message.body)) {
                let base64Data = message.body;
                let ext = 'jpg';
                if (base64Data.startsWith('data:image/')) {
                    const match = base64Data.match(/^data:image\/(\w+);base64,/);
                    if (match) ext = match[1];
                    base64Data = base64Data.replace(/^data:image\/(\w+);base64,/, '');
                }
                // Valida tamanho
                const maxSize = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880');
                const sizeBytes = Buffer.from(base64Data, 'base64').length;
                if (sizeBytes > maxSize) {
                    return {
                        response: `⚠️ O arquivo é muito grande. Envie um arquivo com no máximo ${Math.round(maxSize / 1024 / 1024)}MB.`,
                        newStep: 'awaiting_curriculo_pdf_file',
                        data
                    };
                }
                const fileName = `curriculo_${message.from}_${Date.now()}.${ext}`;
                const filePath = path.join(PDF_UPLOAD_FOLDER, fileName);
                try {
                    await safeWriteFile(filePath, Buffer.from(base64Data, 'base64'));
                    structuredLog('curriculo_received', {
                        from: message.from,
                        fileName,
                        filePath,
                        channel: data.curriculoChannel,
                        sizeBytes
                    });
                } catch (e) {
                    console.error('Erro ao salvar currículo (base64):', e.message);
                    structuredLog('curriculo_save_error', { from: message.from, error: e.message });
                    return {
                        response: '❌ Erro ao salvar o arquivo enviado em base64. Tente novamente ou envie outro arquivo.',
                        newStep: 'awaiting_curriculo_pdf_file',
                        data
                    };
                }
                return {
                    response: '✅ Currículo recebido com sucesso! Muito obrigado pelo interesse! Nossa equipe irá analisar seu perfil e, caso haja compatibilidade, entraremos em contato.\n\nPosso te ajudar com mais alguma coisa?\n\n*1* - Sim\n*2* - Não',
                    newStep: 'curriculo_post_answer',
                    data: data,
                    finalizeSession: false
                };
            }
            // Caso não seja anexo nem base64
            return {
                response: 'Por favor, envie seu currículo em PDF ou como imagem (foto) como anexo nesta conversa. Se quiser cancelar, digite "cancelar".',
                newStep: 'awaiting_curriculo_pdf_file',
                data
            };
        }
        
        // 4. Pós-envio do currículo
        if (step === 'curriculo_post_answer') {
            const answer = body.trim().toLowerCase();
            if (answer === '1' || answer === 'sim' || answer === 's' || answer === 'si') {
                return {
                    response: `👋 Olá, *${userState.data.firstName}*!\n\nComo podemos ajudar você hoje?`,
                    newStep: 'awaiting_main_option',
                    data: { ...data },
                    buttons: [
                        { id: '1', text: '🛠️ Problema com produto' },
                        { id: '2', text: '📄 Nota Fiscal' },
                        { id: '3', text: '💳 Fazer uma compra' },
                        { id: '4', text: '❓ Dúvidas Frequentes' },
                        { id: '5', text: '📄 Enviar Currículo' },
                        { id: '6', text: 'Encerrar conversa' }
                    ]
                };
            }
            if (answer === '2' || answer === 'não' || answer === 'nao' || answer === 'n') {
                return {
                    response: '🙏 *Obrigado por conversar conosco!*\n\nFoi um prazer ajudar você hoje. Se precisar de algo no futuro, estaremos sempre aqui!\n\n✨ Até mais! 👋',
                    newStep: 'start',
                    finalizeSession: true,
                    data: { ...data }
                };
            }
            return {
                response: '⚠️ Por favor, responda com:\n\n*1* - Se deseja mais alguma coisa\n*2* - Se não precisa de mais nada\n\nOu use as palavras *sim* ou *não*:',
                newStep: 'curriculo_post_answer',
                data: { ...data },
                buttons: [
                    { id: '1', text: 'Sim' },
                    { id: '2', text: 'Não' }
                ]
            };
        }
        
        // Fallback
        return {
            response: 'Vamos começar o processo de envio do seu currículo. Por onde você ficou sabendo das nossas vagas?\n\n*1*. Facebook\n*2*. Instagram\n*3*. WhatsApp\n*4*. Por amigos e familiares\n*5*. Outro',
            newStep: 'curriculo_ask_channel',
            data
        };
    }

    // =========================
    // FLUXO DE COMPRA ROBUSTO
    // =========================
    static async handlePurchaseRobust(message, userState) {
        const step = userState.step;
        const userData = userState.data || {};
        const catalogUrl = process.env.CATALOG_URL || 'https://inauguralar.com/catalog';
        const cityAllowed = (process.env.CITY_ALLOWED || '').toLowerCase();
        const onlineStores = (process.env.ONLINE_STORES || '').split(';').filter(Boolean);
        const companyName = process.env.COMPANY_NAME || 'Inaugura Lar';
        const instagramUrl = process.env.INSTAGRAM_URL || 'https://instagram.com/inauguralar';

        switch (step) {
            case 'purchase_ask_catalog': {
                const answer = (message.body || '').toLowerCase();
                if (answer.includes('catalog') || answer.includes('catálogo') || answer.includes('quero ver') || answer.includes('ver catálogo') || answer === '1') {
                    userData._sendMedia = {
                        file: './media/catalog-card.jpg',
                        caption: '🛍️ Veja nosso catálogo digital e descubra ofertas especiais! Qualquer dúvida, estamos aqui para ajudar 😊'
                    };
                    return {
                        response: `🔗 Acesse nosso catálogo online: ${catalogUrl}\n\nQuando finalizar o pedido no site, clique em "Finalizar pelo WhatsApp" para retornar aqui.\n\nSe preferir, digite *continuar pelo WhatsApp* para comprar por aqui.`,
                        newStep: 'purchase_ask_catalog',
                        data: userData,
                        buttons: [
                            { id: '1', text: 'Quero ver o catálogo online' },
                            { id: '2', text: 'Continuar comprando pelo WhatsApp' }
                        ]
                    };
                }
                if (answer.includes('whatsapp') || answer.includes('continuar') || answer === '2') {
                    return {
                        response: '🏙️ Para continuarmos, me diga de qual cidade você está falando? (Assim garantimos o melhor atendimento para você!)',
                        newStep: 'purchase_ask_city',
                        data: userData
                    };
                }
                return {
                    response: `Você já conhece nosso catálogo digital?`,
                    newStep: 'purchase_ask_catalog',
                    data: userData,
                    buttons: [
                        { id: '1', text: 'Quero ver o catálogo online' },
                        { id: '2', text: 'Continuar comprando pelo WhatsApp' }
                    ]
                };
            }

            case 'purchase_ask_city': {
                // Validação robusta de cidade
                function normalizeCity(str) {
                    return (str || '')
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[^a-z\p{L}\s]/gu, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                }

                const cityEnv = (process.env.CITY_ALLOWED || '').split(';')[0] || '';
                const cityEnvNorm = normalizeCity(cityEnv);
                let userCityNorm = '';

                if (message.type === 'chat' && typeof message.body === 'string') {
                    userCityNorm = normalizeCity(message.body);
                    userData.city = message.body?.trim();
                } else {
                    return {
                        response: '🏙️ Por favor, digite o nome da sua cidade para continuar.',
                        newStep: 'purchase_ask_city',
                        data: userData
                    };
                }

                // Verifica se a cidade é permitida
                let isAllowed = false;
                if (userCityNorm === cityEnvNorm || userCityNorm.includes(cityEnvNorm) || cityEnvNorm.includes(userCityNorm)) {
                    isAllowed = true;
                }

                if (!isAllowed) {
                    let linksMsg = '';
                    if (onlineStores.length) {
                        linksMsg += '\n\n🌐 Compre online em nossas lojas oficiais:\n';
                        onlineStores.forEach((url, idx) => {
                            linksMsg += `• Loja ${idx+1}: ${url}\n`;
                        });
                    }
                    linksMsg += `\n📸 Siga nosso Instagram: ${instagramUrl}`;
                    return {
                        response: `⚠️ A compra pelo WhatsApp é exclusiva para clientes da cidade de ${cityEnv}.\n${linksMsg}`,
                        newStep: 'start',
                        data: userData,
                        finalizeSession: true
                    };
                }

                return {
                    response: '📝 Por favor, envie o *nome do produto* que deseja comprar:',
                    newStep: 'purchase_product_name_robust',
                    data: userData
                };
            }

            case 'purchase_product_name_robust': {
                const productName = message.body?.trim();
                if (!productName || productName.length < 2) {
                    return {
                        response: '⚠️ Por favor, informe o *nome do produto* que deseja comprar:',
                        newStep: 'purchase_product_name_robust',
                        data: userData
                    };
                }
                userData.productName = productName;
                return {
                    response: '🔢 Quantas unidades desse produto você deseja comprar?',
                    newStep: 'purchase_quantity_robust',
                    data: userData
                };
            }

            case 'purchase_quantity_robust': {
                const qty = parseInt(message.body?.trim());
                if (isNaN(qty) || qty < 1) {
                    return {
                        response: '⚠️ Por favor, informe a *quantidade* desejada (apenas números):',
                        newStep: 'purchase_quantity_robust',
                        data: userData
                    };
                }
                userData.quantity = qty;
                return {
                    response: '❓ Tem alguma dúvida ou observação sobre o produto?\nSe não, responda "não".',
                    newStep: 'purchase_questions_robust',
                    data: userData
                };
            }

            case 'purchase_questions_robust': {
                const obs = message.body?.trim();
                userData.questions = (obs && (obs.toLowerCase() !== 'não' && obs.toLowerCase() !== 'nao')) ? obs : 'Nenhuma dúvida.';
                
                let resumo = `*Resumo do seu pedido:*\n• Produto: ${userData.productName}\n• Quantidade: ${userData.quantity}\n• Observação: ${userData.questions}`;
                userData._sendMedia = {
                    file: './media/order-summary.jpg',
                    caption: '📝 Aqui está um resumo visual do seu pedido! Confira se está tudo certinho. Qualquer ajuste, é só avisar 😉'
                };
                return {
                    response: resumo + '\n\nEstá tudo certo? (Responda "sim" para continuar ou "não" para refazer)',
                    newStep: 'purchase_confirm_order_robust',
                    data: userData
                };
            }

            case 'purchase_confirm_order_robust': {
                const answer = (message.body || '').toLowerCase();
                if (answer.includes('não') || answer.includes('nao')) {
                    return {
                        response: '🔄 Ok, vamos reiniciar o pedido.\n\nPor favor, envie o *nome do produto* que deseja comprar:',
                        newStep: 'purchase_product_name_robust',
                        data: {},
                        buttons: [
                            { id: '1', text: 'Refazer pedido' }
                        ]
                    };
                }
                return {
                    response: '👤 Para finalizar, envie seu *nome completo*:',
                    newStep: 'purchase_ask_name_robust',
                    data: userData
                };
            }

            case 'purchase_ask_name_robust': {
                const name = message.body?.trim();
                if (!name || name.split(' ').length < 2) {
                    return {
                        response: '⚠️ Por favor, informe seu *nome completo* (pelo menos duas palavras):',
                        newStep: 'purchase_ask_name_robust',
                        data: userData
                    };
                }
                userData.name = name;
                return {
                    response: '🏠 Agora, envie seu *endereço completo* com CEP:',
                    newStep: 'purchase_ask_address_robust',
                    data: userData
                };
            }

            case 'purchase_ask_address_robust': {
                const address = message.body?.trim();
                if (!address || address.length < 8) {
                    return {
                        response: '⚠️ Endereço inválido. Por favor, envie seu *endereço completo* com CEP:',
                        newStep: 'purchase_ask_address_robust',
                        data: userData
                    };
                }
                userData.address = address;
                
                return {
                    response: '🏠 **Endereço confirmado!**\n\n💳 Qual forma de pagamento?\n\n**PIX** ou **Dinheiro**?',
                    newStep: 'purchase_ask_payment_robust',
                    data: userData
                };
            }

            case 'purchase_ask_payment_robust': {
                const answer = (message.body || '').toLowerCase();
                const pixKey = process.env.PIX_KEY || 'chave-pix-exemplo';
                if (answer.includes('pix')) {
                    userData.paymentMethod = 'PIX';
                    return {
                        response: `🔑 Chave PIX: *${pixKey}*\n\nDeseja já realizar o pagamento agora para agilizar?`,
                        newStep: 'purchase_pix_choose_when',
                        data: userData,
                        buttons: [
                            { id: '1', text: 'Sim, quero pagar agora' },
                            { id: '2', text: 'Prefiro pagar na hora de receber' }
                        ]
                    };
                } else if (answer.includes('dinheiro')) {
                    userData.paymentMethod = 'Dinheiro';
                    return {
                        response: '💵 Pagamento em dinheiro será feito na entrega.\n\nSeu pedido foi registrado! Aguarde a confirmação de um atendente.',
                        newStep: 'purchase_notify_attendant_robust',
                        data: userData
                    };
                } else {
                    return {
                        response: '⚠️ Forma de pagamento inválida. Responda *PIX* ou *Dinheiro*.',
                        newStep: 'purchase_ask_payment_robust',
                        data: userData,
                        buttons: [
                            { id: '1', text: 'PIX' },
                            { id: '2', text: 'Dinheiro' }
                        ]
                    };
                }
            }

            case 'purchase_pix_choose_when': {
                const answer = (message.body || '').toLowerCase();
                const pixKey = process.env.PIX_KEY || 'chave-pix-exemplo';
                if (answer === '1' || answer.includes('sim') || answer.includes('agora') || answer.includes('comprovante') || answer.includes('pagar agora')) {
                    return {
                        response: 'Ótimo! Por favor, envie o comprovante do pagamento PIX em imagem para prosseguirmos com a análise e liberação do pedido.',
                        newStep: 'purchase_awaiting_pix_proof_robust',
                        data: userData
                    };
                } else if (answer === '2' || answer.includes('hora') || answer.includes('receber') || answer.includes('entrega')) {
                    return {
                        response: `Sem problemas! Você pode pagar via PIX na hora que receber o produto.\n\nSe quiser agilizar, já deixo aqui a chave PIX: *${pixKey}*\n\nSeu pedido foi registrado e será preparado. Qualquer dúvida, estamos à disposição!`,
                        newStep: 'purchase_notify_attendant_robust',
                        data: userData
                    };
                } else {
                    return {
                        response: 'Por favor, responda *1* para pagar agora, *2* para pagar na hora de receber, ou envie "comprovante" para enviar o comprovante.',
                        newStep: 'purchase_pix_choose_when',
                        data: userData,
                        buttons: [
                            { id: '1', text: 'Pagar agora' },
                            { id: '2', text: 'Pagar na entrega' }
                        ]
                    };
                }
            }

            case 'purchase_awaiting_pix_proof_robust': {
                if (message.hasMedia) {
                    // Aqui você processaria o comprovante PIX
                    userData.pixProofReceived = true;
                    userData.pixProofTimestamp = new Date().toISOString();
                    
                    return {
                        response: '🔎 Comprovante analisado! O atendente confirmará em instantes.',
                        newStep: 'purchase_notify_attendant_robust',
                        data: userData
                    };
                } else {
                    return {
                        response: '⚠️ Por favor, envie o *comprovante do pagamento PIX* como imagem.',
                        newStep: 'purchase_awaiting_pix_proof_robust',
                        data: userData
                    };
                }
            }

            case 'purchase_notify_attendant_robust': {
                userData._sendMedia = {
                    file: './media/order-confirmed.jpg',
                    caption: '🎉 Pedido recebido com sucesso! Agora é só aguardar a confirmação. Obrigado por confiar na Inaugura Lar! 💙'
                };
                userData._sendFeedback = true;
                
                // Log do pedido
                logEvent('order_completed', {
                    from: message.from,
                    orderData: userData,
                    timestamp: new Date().toISOString()
                });
                
                return {
                    response: '✅ Seu pedido está em análise com nossa equipe. Assim que o pagamento for validado, você receberá uma confirmação e o envio será iniciado. Se precisar de qualquer coisa, digite "atendente". Muito obrigado por comprar conosco! 🙏',
                    newStep: 'start',
                    data: userData,
                    finalizeSession: true
                };
            }

            default:
                return {
                    response: '❌ Fluxo de compra não reconhecido. Digite "menu" para voltar ao início.',
                    newStep: 'start',
                    data: userData
                };
        }
    }

    // =========================
    // FLUXO DE COMPRA VIA CATÁLOGO
    // =========================
    static async handlePurchaseCatalog(message, userState) {
        const step = userState.step;
        const userData = userState.data || {};
        
        switch (step) {
            case 'purchase_catalog_awaiting_name': {
                const name = message.body?.trim();
                if (!name || name.split(' ').length < 2) {
                    return {
                        response: '⚠️ Por favor, informe seu *nome completo* (pelo menos duas palavras):',
                        newStep: 'purchase_catalog_awaiting_name',
                        data: userData
                    };
                }
                userData.name = name;
                return {
                    response: '🏠 Agora, por favor envie seu *endereço completo* com CEP:',
                    newStep: 'purchase_catalog_awaiting_address',
                    data: userData
                };
            }

            case 'purchase_catalog_awaiting_address': {
                const address = message.body?.trim();
                if (!address || address.length < 8) {
                    return {
                        response: '⚠️ Endereço inválido. Por favor, envie seu *endereço completo* com CEP:',
                        newStep: 'purchase_catalog_awaiting_address',
                        data: userData
                    };
                }
                userData.address = address;
                return {
                    response: '✅ Endereço recebido! Em breve enviaremos as instruções de pagamento PIX.',
                    newStep: 'purchase_catalog_awaiting_pix',
                    data: userData
                };
            }

            case 'purchase_catalog_awaiting_pix': {
                return {
                    response: '💳 Para finalizar, envie o comprovante do pagamento PIX para esta chave: *' + (process.env.PIX_KEY || 'chave-pix-exemplo') + '*',
                    newStep: 'purchase_catalog_awaiting_proof',
                    data: userData
                };
            }

            case 'purchase_catalog_awaiting_proof': {
                if (message.hasMedia) {
                    userData.pixProofReceived = true;
                    userData.pixProofTimestamp = new Date().toISOString();
                    
                    return {
                        response: '🔎 Comprovante recebido! Aguarde a validação. Em breve um atendente irá te chamar. Obrigado pela compra!',
                        newStep: 'purchase_catalog_done',
                        data: userData
                    };
                } else {
                    return {
                        response: '⚠️ Por favor, envie o *comprovante do pagamento PIX* como imagem.',
                        newStep: 'purchase_catalog_awaiting_proof',
                        data: userData
                    };
                }
            }

            case 'purchase_catalog_done': {
                return {
                    response: '✅ Seu pedido está em análise. Assim que o pagamento for validado, você receberá uma confirmação e o envio será iniciado. Se precisar de atendimento, digite "atendente".',
                    newStep: 'start',
                    data: userData,
                    finalizeSession: true
                };
            }

            default:
                return {
                    response: '❌ Fluxo de compra via site não reconhecido. Digite "menu" para voltar ao início.',
                    newStep: 'start',
                    data: userData
                };
        }
    }

    // =========================
    // FLUXO DE COMPRA TRADICIONAL
    // =========================
    static async handlePurchase(message, userState) {
        const step = userState.step;
        const userData = userState.data || {};
        
        switch (step) {
            case 'purchase_product_name': {
                const productName = message.body?.trim();
                if (!productName || productName.length < 2) {
                    return {
                        response: '⚠️ Por favor, informe o *nome do produto* que deseja comprar:',
                        newStep: 'purchase_product_name',
                        data: userData
                    };
                }
                userData.productName = productName;
                return {
                    response: '🔗 Se você tiver o *link do produto* do *Mercado Livre*, envie agora.\n\n🏪 *NOSSA LOJA OFICIAL:*\nhttps://www.mercadolivre.com.br/loja/inaugura-lar\n\n⚠️ Se não tiver o link, responda *"não"* para pular.',
                    newStep: 'purchase_product_link',
                    data: userData
                };
            }

            case 'purchase_product_link': {
                const link = message.body?.trim();
                if (link && (link.toLowerCase() === 'não' || link.toLowerCase() === 'nao')) {
                    userData.productLink = '';
                    return {
                        response: '📸 Por favor, envie uma *foto do produto* que deseja comprar.\n\nSe não tiver foto, responda "não".',
                        newStep: 'purchase_product_photo',
                        data: userData
                    };
                }
                if (link && !/^https?:\/\//.test(link)) {
                    return {
                        response: '⚠️ O link informado não parece válido. Se não tiver o link, responda "não".\n\nSe tiver, envie o link completo (começando com http).',
                        newStep: 'purchase_product_link',
                        data: userData
                    };
                }
                if (link && /^https?:\/\//.test(link)) {
                    userData.productLink = link;
                    return {
                        response: '✅ Link recebido!\n\n🔢 Quantas unidades desse produto você deseja comprar?',
                        newStep: 'purchase_quantity',
                        data: userData
                    };
                }
                return {
                    response: '⚠️ Por favor, envie o *link do produto* da nossa loja do Mercado Livre ou responda "não" para pular.',
                    newStep: 'purchase_product_link',
                    data: userData
                };
            }

            case 'purchase_product_photo': {
                if (message.hasMedia) {
                    userData.productPhoto = `Foto produto compra - ${message.id._serialized}`;
                    return {
                        response: '🔢 Quantas unidades desse produto você deseja comprar?',
                        newStep: 'purchase_quantity',
                        data: userData
                    };
                } else if (message.body && (message.body.trim().toLowerCase() === 'não' || message.body.trim().toLowerCase() === 'nao')) {
                    userData.productPhoto = '';
                    return {
                        response: '🔢 Quantas unidades desse produto você deseja comprar?',
                        newStep: 'purchase_quantity',
                        data: userData
                    };
                } else {
                    return {
                        response: '⚠️ Por favor, envie uma *foto do produto* ou responda "não" para pular.',
                        newStep: 'purchase_product_photo',
                        data: userData
                    };
                }
            }

            case 'purchase_quantity': {
                const qty = parseInt(message.body?.trim());
                if (isNaN(qty) || qty < 1) {
                    return {
                        response: '⚠️ Por favor, informe a *quantidade* desejada (apenas números):',
                        newStep: 'purchase_quantity',
                        data: userData
                    };
                }
                userData.quantity = qty;
                return {
                    response: '❓ Tem alguma dúvida ou observação sobre o produto?\n\nSe sim, escreva agora. Se não, responda "não".',
                    newStep: 'purchase_questions',
                    data: userData
                };
            }

            case 'purchase_questions': {
                const obs = message.body?.trim();
                userData.questions = (obs && (obs.toLowerCase() !== 'não' && obs.toLowerCase() !== 'nao')) ? obs : 'Nenhuma dúvida.';
                const queuePosition = Math.floor(Math.random() * 5) + 1;
                return {
                    response: `👨‍💼 *Solicitação de Compra enviada!*\n\nVocê foi adicionado à fila de atendimento para finalizar sua compra.\n\n📦 Produto: *${userData.productName}*\n${userData.productLink ? '🔗 Link: ' + userData.productLink + '\n' : ''}${userData.productPhoto ? '📸 Foto enviada\n' : ''}🔢 Quantidade: *${userData.quantity}*\n📝 Observação: ${userData.questions}\n\n⏳ Aguarde, em breve um atendente estará com você!\n\n*Sua posição na fila:* ${queuePosition}`,
                    newStep: 'transfer_to_human',
                    data: {
                        ...userData,
                        queuePosition: queuePosition,
                        flowType: 'purchase'
                    }
                };
            }

            default:
                return {
                    response: '❌ Erro no fluxo de compra. Digite "menu" para voltar ao início.',
                    newStep: 'start',
                    data: userData
                };
        }
    }

    // =========================
    // FLUXO DE PROBLEMA COM PRODUTO
    // =========================
    static async handleProductIssue(message, userState) {
        const step = userState.step;
        const userData = userState.data || {};
        switch (step) {
            case 'product_issue_nf':
                return this._handleProductIssueNF(message, userData);
            case 'product_issue_photo':
                return this._handleProductIssuePhoto(message, userData);
            case 'product_issue_box_photo':
                return this._handleProductIssueBoxPhoto(message, userData);
            case 'product_issue_label_photo':
                return this._handleProductIssueLabelPhoto(message, userData);
            case 'product_issue_address':
                return this._handleProductIssueAddress(message, userData);
            case 'product_issue_comments':
                return this._handleProductIssueComments(message, userData);
            default:
                return this._handleProductIssueDefault(userData);
        }
    }

    static _handleProductIssueNF(message, userData) {
        if (message.hasMedia) {
            userData.invoicePhoto = `Foto NF - ${message.id?._serialized || ''}`;
            return {
                response: '📸 Foto da nota fiscal recebida! Agora, por favor, envie uma foto do produto com defeito:',
                newStep: 'product_issue_photo',
                data: userData
            };
        } else if (message.body?.trim()) {
            const invoiceNumber = message.body.trim();
            if (invoiceNumber.length < 3) {
                return {
                    response: '⚠️ Número muito curto. Por favor, informe o número completo do pedido/nota fiscal (mínimo 3 caracteres) ou envie uma foto da nota fiscal.',
                    newStep: 'product_issue_nf',
                    data: userData,
                    buttons: [
                        { id: '1', text: 'Enviar foto da nota' },
                        { id: '2', text: 'Não tenho nota' }
                    ]
                };
            }
            userData.invoiceNumber = invoiceNumber;
            return {
                response: '📋 Número do pedido/nota fiscal registrado! Agora, por favor, envie uma foto do produto com defeito:',
                newStep: 'product_issue_photo',
                data: userData
            };
        } else {
            return {
                response: '⚠️ Por favor, envie:\n• Uma foto da nota fiscal, ou\n• Digite o número do pedido/nota fiscal (mínimo 3 caracteres)',
                newStep: 'product_issue_nf',
                data: userData,
                buttons: [
                    { id: '1', text: 'Enviar foto da nota' },
                    { id: '2', text: 'Não tenho nota' }
                ]
            };
        }
    }

    static _handleProductIssuePhoto(message, userData) {
        // Permite ao usuário voltar ao menu digitando "voltar", "menu" ou "sair"
        const bodyNorm = (message.body && typeof message.body === 'string') ? ConversationFlow.normalizeText(message.body) : '';
        if (['voltar', 'menu', 'sair'].includes(bodyNorm)) {
            return {
                response: `👋 Olá! Como podemos ajudar você hoje?\n\n*1*. 🛠️ Problema com produto\n*2*. 🧾 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes\n*5*. 📄 Enviar Currículo\n*6*. Encerrar conversa\n\nResponda com o *número* ou *palavra-chave* da opção desejada.`,
                newStep: 'awaiting_main_option',
                data: userData
            };
        }
        if (message.hasMedia) {
            // Salva identificador da foto do produto defeituoso
            userData.productPhoto = `Foto produto defeituoso - ${message.id?._serialized || ''}`;
            return {
                response: '📦 Foto do produto recebida! Por favor, envie também uma foto da caixa/embalagem (se ainda tiver). Se não tiver, responda "não tenho".',
                newStep: 'product_issue_box_photo',
                data: userData
            };
        } else {
            return {
                response: '⚠️ Por favor, envie uma foto do produto com defeito ou digite "voltar" para retornar ao menu.',
                newStep: 'product_issue_photo',
                data: userData
            };
        }
    }

    static _handleProductIssueBoxPhoto(message, userData) {
        // Permite cancelar ou voltar ao menu
        const bodyNorm = (message.body && typeof message.body === 'string') ? ConversationFlow.normalizeText(message.body) : '';
        if (['voltar', 'menu', 'sair'].includes(bodyNorm)) {
            return {
                response: `👋 Olá! Como podemos ajudar você hoje?\n\n*1*. 🛠️ Problema com produto\n*2*. 🧾 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes\n*5*. 📄 Enviar Currículo\n*6*. Encerrar conversa\n\nResponda com o *número* ou *palavra‑chave* da opção desejada.`,
                newStep: 'awaiting_main_option',
                data: userData
            };
        }
        if (message.body && !message.hasMedia) {
            const negativeResponses = ['não tenho', 'nao tenho', 'não', 'nao', 'joguei fora', 'perdi', 'não tem', 'nao tem'];
            const userResponse = bodyNorm;
            if (negativeResponses.some(neg => userResponse.includes(ConversationFlow.normalizeText(neg)))) {
                userData.boxPhoto = `Não possui caixa/embalagem - ${message.body.trim()}`;
                return {
                    response: '📝 Entendido! Você não tem mais a caixa/embalagem. Por favor, envie uma foto da etiqueta de entrega (com QR CODE, se ainda tiver), ou responda "não tenho":',
                    newStep: 'product_issue_label_photo',
                    data: userData
                };
            }
        }
        if (message.hasMedia) {
            userData.boxPhoto = `Foto caixa/embalagem - ${message.id?._serialized || ''}`;
            return {
                response: '📦 Foto da caixa recebida! Por favor, envie uma foto da etiqueta de entrega (com QR CODE, se ainda tiver), ou responda "não tenho":',
                newStep: 'product_issue_label_photo',
                data: userData
            };
        } else {
            return {
                response: '⚠️ Por favor:\n• Envie uma foto da caixa/embalagem, ou\n• Responda "não tenho" se não possuir\n\nVocê também pode digitar "voltar" para retornar ao menu.',
                newStep: 'product_issue_box_photo',
                data: userData
            };
        }
    }

    static _handleProductIssueLabelPhoto(message, userData) {
        // Permite cancelar ou voltar ao menu
        const bodyNorm = (message.body && typeof message.body === 'string') ? ConversationFlow.normalizeText(message.body) : '';
        if (['voltar', 'menu', 'sair'].includes(bodyNorm)) {
            return {
                response: `👋 Olá! Como podemos ajudar você hoje?\n\n*1*. 🛠️ Problema com produto\n*2*. 🧾 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes\n*5*. 📄 Enviar Currículo\n*6*. Encerrar conversa\n\nResponda com o *número* ou *palavra‑chave* da opção desejada.`,
                newStep: 'awaiting_main_option',
                data: userData
            };
        }
        if (message.body && !message.hasMedia) {
            const negativeResponses = ['não tenho', 'nao tenho', 'não', 'nao', 'joguei fora', 'perdi', 'não tem', 'nao tem'];
            const userResponse = bodyNorm;
            if (negativeResponses.some(neg => userResponse.includes(ConversationFlow.normalizeText(neg)))) {
                userData.labelPhoto = `Não possui etiqueta de entrega - ${message.body.trim()}`;
                return {
                    response: '📝 Entendido! Você não tem mais a etiqueta de entrega. Confirme seu endereço completo para possível troca/devolução:',
                    newStep: 'product_issue_address',
                    data: userData
                };
            }
        }
        if (message.hasMedia) {
            userData.labelPhoto = `Foto etiqueta entrega - ${message.id?._serialized || ''}`;
            return {
                response: '🏷️ Foto da etiqueta recebida! Confirme seu endereço completo para possível troca/devolução:',
                newStep: 'product_issue_address',
                data: userData
            };
        } else {
            return {
                response: '⚠️ Por favor:\n• Envie uma foto da etiqueta de entrega com QR CODE, ou\n• Responda "não tenho" se não possuir\n\nVocê também pode digitar "voltar" para retornar ao menu.',
                newStep: 'product_issue_label_photo',
                data: userData
            };
        }
    }

    static _handleProductIssueAddress(message, userData) {
        const address = message.body?.trim();
        if (!address || address.length < 8) {
            return {
                response: '⚠️ Endereço inválido. Por favor, informe seu endereço completo com CEP.',
                newStep: 'product_issue_address',
                data: userData
            };
        }
        userData.address = address;
        return {
            response: '📍 Endereço confirmado! Por último, descreva brevemente qual é o problema com o produto (ex: chegou quebrado, não funciona, cor errada, etc.):',
            newStep: 'product_issue_comments',
            data: userData
        };
    }

    static _handleProductIssueComments(message, userData) {
        const comments = message.body?.trim();
        if (!comments || comments.length < 5) {
            return {
                response: '⚠️ Por favor, descreva qual é o problema com o produto (mínimo 5 caracteres):',
                newStep: 'product_issue_comments',
                data: userData
            };
        }
        userData.problemDescription = comments;
        const queuePosition = Math.floor(Math.random() * 5) + 1;
        let summary = '📋 Resumo do seu problema:\n';
        if (userData.invoiceNumber) {
            summary += `🧾 Pedido/NF: ${userData.invoiceNumber}\n`;
        } else if (userData.invoicePhoto) {
            summary += '📸 Foto da NF enviada\n';
        }
        summary += '📸 Foto do produto enviada\n';
        if (userData.boxPhoto) {
            if (userData.boxPhoto.includes('Não possui')) {
                summary += '📦 Cliente não possui mais a caixa\n';
            } else {
                summary += '📦 Foto da caixa enviada\n';
            }
        }
        if (userData.labelPhoto) {
            if (userData.labelPhoto.includes('Não possui')) {
                summary += '🏷️ Cliente não possui mais a etiqueta\n';
            } else {
                summary += '🏷️ Foto da etiqueta enviada\n';
            }
        }
        summary += '📍 Endereço confirmado\n';
        summary += `💬 Problema: ${comments}`;
        return {
            response: `✅ Problema registrado com sucesso! Você foi adicionado à fila de atendimento especializado.\n\n${summary}\n\n⏳ Aguarde, em breve um especialista estará com você!\nSua posição na fila: ${queuePosition}\n\n💡 Opções:\n• Digite "sair" para voltar ao menu principal\n• Aguarde sua vez para ser atendido`,
            newStep: 'transfer_to_human',
            data: {
                ...userData,
                queuePosition: queuePosition,
                flowType: 'product_issue'
            },
            buttons: [
                { id: '1', text: 'Voltar ao menu' }
            ]
        };
    }

    static _handleProductIssueDefault(userData) {
        return {
            response: '📋 Registro de Problema com Produto\n\nPara agilizar seu atendimento, por favor envie:\n1️⃣ Nota fiscal ou número do pedido\n(Você pode enviar uma foto da nota fiscal ou apenas digitar o número).',
            newStep: 'product_issue_nf',
            data: {
                ...userData,
                flowType: 'product_issue'
            },
            buttons: [
                { id: '1', text: 'Enviar foto da nota' },
                { id: '2', text: 'Não tenho nota' }
            ]
        };
    }

    // =========================
    // FLUXO DE CARRINHO
    // =========================
    static async handleCartFlow(message, userState) {
        let cart = userState.data?.cart || [];
        let step = userState.step;
        let data = userState.data || {};
        const body = (message.body || '').trim().toLowerCase();

        // Comandos globais com botões
        if (body === 'cancelar') {
            return {
                response: '❌ Carrinho cancelado. Se quiser começar de novo, digite "comprar".',
                newStep: 'awaiting_main_option',
                data: {},
                buttons: [
                    { id: '1', text: 'Voltar ao menu' },
                    { id: '2', text: 'Fazer uma compra' }
                ]
            };
        }

        if (body === 'finalizar') {
            if (!cart.length) {
                return {
                    response: '🛒 Seu carrinho está vazio. Adicione pelo menos um produto antes de finalizar.',
                    newStep: 'cart_add_product',
                    data,
                    buttons: [
                        { id: '1', text: 'Adicionar produto' },
                        { id: '2', text: 'Cancelar' }
                    ]
                };
            }
            data.cart = cart;
            return {
                response: this.formatCart(cart) + '\n\nPara finalizar, envie seu *nome completo*:',
                newStep: 'cart_ask_name',
                data,
                buttons: [
                    { id: '1', text: 'Voltar ao carrinho' },
                    { id: '2', text: 'Cancelar' }
                ]
            };
        }

        if (body === 'ver carrinho' || body === 'carrinho') {
            return {
                response: this.formatCart(cart) + '\n\nEscolha uma opção:',
                newStep: 'cart_menu',
                data,
                buttons: [
                    { id: '1', text: 'Adicionar produto' },
                    { id: '2', text: 'Remover item' },
                    { id: '3', text: 'Editar quantidade' },
                    { id: '4', text: 'Finalizar compra' },
                    { id: '5', text: 'Cancelar' }
                ]
            };
        }

        // Fluxo principal
        switch (step) {
            case 'cart_start':
            case 'cart_add_product': {
                if (body === 'adicionar' || !cart.length) {
                    return {
                        response: '📝 Envie o *nome do produto* que deseja adicionar ao carrinho:',
                        newStep: 'cart_ask_product_name',
                        data,
                        buttons: [
                            { id: '1', text: 'Cancelar' },
                            { id: '2', text: 'Ver carrinho' }
                        ]
                    };
                }
                if (body === 'remover') {
                    if (!cart.length) {
                        return {
                            response: 'Seu carrinho está vazio.',
                            newStep: 'cart_add_product',
                            data,
                            buttons: [
                                { id: '1', text: 'Adicionar produto' },
                                { id: '2', text: 'Cancelar' }
                            ]
                        };
                    }
                    return {
                        response: this.formatCart(cart) + '\n\nDigite o número do item que deseja remover:',
                        newStep: 'cart_remove_item',
                        data,
                        buttons: cart.map((item, i) => ({ id: String(i + 1), text: `Remover: ${item.name}` })).concat([
                            { id: '0', text: 'Cancelar' }
                        ])
                    };
                }
                if (body === 'editar') {
                    if (!cart.length) {
                        return {
                            response: 'Seu carrinho está vazio.',
                            newStep: 'cart_add_product',
                            data,
                            buttons: [
                                { id: '1', text: 'Adicionar produto' },
                                { id: '2', text: 'Cancelar' }
                            ]
                        };
                    }
                    return {
                        response: this.formatCart(cart) + '\n\nDigite o número do item que deseja editar a quantidade:',
                        newStep: 'cart_edit_item',
                        data,
                        buttons: cart.map((item, i) => ({ id: String(i + 1), text: `Editar: ${item.name}` })).concat([
                            { id: '0', text: 'Cancelar' }
                        ])
                    };
                }
                return {
                    response: 'Comando não reconhecido. Escolha uma opção:',
                    newStep: 'cart_add_product',
                    data,
                    buttons: [
                        { id: '1', text: 'Adicionar produto' },
                        { id: '2', text: 'Remover item' },
                        { id: '3', text: 'Editar quantidade' },
                        { id: '4', text: 'Finalizar compra' },
                        { id: '5', text: 'Cancelar' }
                    ]
                };
            }
            
            case 'cart_ask_product_name': {
                if (!message.body || message.body.length < 2) {
                    return {
                        response: '⚠️ Informe o *nome do produto* (mínimo 2 letras):',
                        newStep: 'cart_ask_product_name',
                        data,
                        buttons: [
                            { id: '1', text: 'Cancelar' }
                        ]
                    };
                }
                data._currentProduct = message.body.trim();
                return {
                    response: '🔢 Quantas unidades desse produto?',
                    newStep: 'cart_ask_product_qty',
                    data,
                    buttons: [
                        { id: '1', text: 'Cancelar' }
                    ]
                };
            }
            case 'cart_ask_product_qty': {
                const qty = parseInt(message.body?.trim());
                if (isNaN(qty) || qty < 1) {
                    return {
                        response: '⚠️ Informe a *quantidade* (apenas números):',
                        newStep: 'cart_ask_product_qty',
                        data,
                        buttons: [
                            { id: '1', text: 'Cancelar' }
                        ]
                    };
                }
                cart.push({ name: data._currentProduct, qty });
                data.cart = cart;
                delete data._currentProduct;
                return {
                    response: this.formatCart(cart) + '\n\nProduto adicionado! Escolha uma opção:',
                    newStep: 'cart_add_product',
                    data,
                    buttons: [
                        { id: '1', text: 'Adicionar produto' },
                        { id: '2', text: 'Remover item' },
                        { id: '3', text: 'Editar quantidade' },
                        { id: '4', text: 'Finalizar compra' },
                        { id: '5', text: 'Cancelar' }
                    ]
                };
            }
            case 'cart_remove_item': {
                const idx = parseInt(message.body?.trim()) - 1;
                if (isNaN(idx) || idx < 0 || idx >= cart.length) {
                    return {
                        response: 'Número inválido. Digite o número do item que deseja remover:',
                        newStep: 'cart_remove_item',
                        data,
                        buttons: cart.map((item, i) => ({ id: String(i + 1), text: `Remover: ${item.name}` })).concat([
                            { id: '0', text: 'Cancelar' }
                        ])
                    };
                }
                cart.splice(idx, 1);
                data.cart = cart;
                return {
                    response: this.formatCart(cart) + '\n\nItem removido! Escolha uma opção:',
                    newStep: 'cart_add_product',
                    data,
                    buttons: [
                        { id: '1', text: 'Adicionar produto' },
                        { id: '2', text: 'Remover item' },
                        { id: '3', text: 'Editar quantidade' },
                        { id: '4', text: 'Finalizar compra' },
                        { id: '5', text: 'Cancelar' }
                    ]
                };
            }
            case 'cart_edit_item': {
                const idx = parseInt(message.body?.trim()) - 1;
                if (isNaN(idx) || idx < 0 || idx >= cart.length) {
                    return {
                        response: 'Número inválido. Digite o número do item que deseja editar:',
                        newStep: 'cart_edit_item',
                        data,
                        buttons: cart.map((item, i) => ({ id: String(i + 1), text: `Editar: ${item.name}` })).concat([
                            { id: '0', text: 'Cancelar' }
                        ])
                    };
                }
                data._editIdx = idx;
                return {
                    response: `Digite a nova quantidade para *${cart[idx].name}* (atual: ${cart[idx].qty}):`,
                    newStep: 'cart_edit_qty',
                    data,
                    buttons: [
                        { id: '1', text: 'Cancelar' }
                    ]
                };
            }
            case 'cart_edit_qty': {
                const qty = parseInt(message.body?.trim());
                if (isNaN(qty) || qty < 1) {
                    return {
                        response: 'Quantidade inválida. Digite um número maior que zero:',
                        newStep: 'cart_edit_qty',
                        data,
                        buttons: [
                            { id: '1', text: 'Cancelar' }
                        ]
                    };
                }
                cart[data._editIdx].qty = qty;
                data.cart = cart;
                delete data._editIdx;
                return {
                    response: this.formatCart(cart) + '\n\nQuantidade atualizada! Escolha uma opção:',
                    newStep: 'cart_add_product',
                    data,
                    buttons: [
                        { id: '1', text: 'Adicionar produto' },
                        { id: '2', text: 'Remover item' },
                        { id: '3', text: 'Editar quantidade' },
                        { id: '4', text: 'Finalizar compra' },
                        { id: '5', text: 'Cancelar' }
                    ]
                };
            }
            case 'cart_menu': {
                return {
                    response: this.formatCart(cart) + '\n\nEscolha uma opção:',
                    newStep: 'cart_add_product',
                    data,
                    buttons: [
                        { id: '1', text: 'Adicionar produto' },
                        { id: '2', text: 'Remover item' },
                        { id: '3', text: 'Editar quantidade' },
                        { id: '4', text: 'Finalizar compra' },
                        { id: '5', text: 'Cancelar' }
                    ]
                };
            }
            case 'cart_ask_name': {
                const name = message.body?.trim();
                if (!name || name.split(' ').length < 2) {

                    return {
                        response: '⚠️ Informe seu *nome completo* (pelo menos duas palavras):',
                        newStep: 'cart_ask_name',
                        data,
                        buttons: [
                            { id: '1', text: 'Cancelar' }
                        ]
                    };
                }
                data.name = name;
                return {
                    response: '🏠 Agora, envie seu *endereço completo* com CEP:',
                    newStep: 'cart_ask_address',
                    data,
                    buttons: [
                        { id: '1', text: 'Cancelar' }
                    ]
                };
            }
            case 'cart_ask_address': {
                const address = message.body?.trim();
                if (!address || address.length < 8) {
                    return {
                        response: '⚠️ Endereço inválido. Por favor, envie seu *endereço completo* com CEP:',
                        newStep: 'cart_ask_address',
                        data,
                        buttons: [
                            { id: '1', text: 'Cancelar' }
                        ]
                    };
                }
                data.address = address;
                return {
                    response: '✅ Pedido registrado! Em breve um atendente irá confirmar os detalhes e combinar o pagamento. Obrigado por comprar conosco! Se quiser, digite "menu" para voltar ao início.',
                    newStep: 'start',
                    data,
                    finalizeSession: true,
                    buttons: [
                        { id: '1', text: 'Voltar ao menu' }
                    ]
                };
            }
            default:
                return {
                    response: 'Comando não reconhecido. Escolha uma opção:',
                    newStep: 'cart_add_product',
                    data,
                    buttons: [
                        { id: '1', text: 'Adicionar produto' },
                        { id: '2', text: 'Remover item' },
                        { id: '3', text: 'Editar quantidade' },
                        { id: '4', text: 'Finalizar compra' },
                        { id: '5', text: 'Cancelar' }
                    ]
                };
        }
    }

    static async handleHumanTransfer(message, userState) {
        const messageBody = this.normalizeText(message.body || '');
        const chatId = message.from;
        const attendantsGroupId = process.env.ATTENDANTS_GROUP_ID;
        
        // Remove usuário da fila se solicitar saída
        if (['sair', 'cancelar', 'voltar'].includes(messageBody)) {
            // Remove da fila global
            if (global.humanQueue && Array.isArray(global.humanQueue)) {
                global.humanQueue = global.humanQueue.filter((id) => id !== chatId);
            }
            // Notifica dashboard que o usuário saiu da fila
            broadcastEvent('queue:leave', { chatId, timestamp: new Date().toISOString() });
            return {
                response: `🚪 Você saiu da fila de atendimento.\n\nComo podemos ajudar você hoje?\n\n*1*. 🛠️ Problema com produto\n*2*. 📄 Nota Fiscal\n*3*. 💳 Fazer uma compra\n*4*. ❓ Dúvidas Frequentes\n*5*. 📄 Enviar Currículo\n*6*. Encerrar conversa\n\nResponda com o *número* ou *palavra-chave* da opção desejada.`,
                newStep: 'awaiting_main_option',
                data: userState.data
            };
        }

        // Garante que o usuário esteja na fila e atualiza métrica de entrada
        if (!global.humanQueue.includes(chatId)) {
            global.humanQueue.push(chatId);
            // Atualiza métrica de entrada na fila se não existir
            userState.data = userState.data || {};
            userState.data.metrics = userState.data.metrics || {};
            if (!userState.data.metrics.queueEnterTime) {
                userState.data.metrics.queueEnterTime = new Date().toISOString();
            }
            // Salvar estado em background (não aguardar)
            global.saveUserState(chatId, userState).catch(() => {});
            // Notifica dashboard
            broadcastEvent('queue:join', { chatId, position: global.humanQueue.indexOf(chatId) + 1, name: userState.data?.name || userState.data?.firstName || null, timestamp: new Date().toISOString() });
        }
        const position = global.humanQueue.indexOf(chatId) + 1;
        // Calcula tempo de espera estimado (exemplo simples: 3-5 minutos por posição)
        const waitTime = position === 1 ? '2-5 minutos' : `${position * 3}-${position * 5} minutos`;

        // Encaminha mensagem do usuário para o grupo de atendentes quando há texto ou mídia
        if (attendantsGroupId && globalThis.wppClient) {
            // Se o usuário enviou uma mensagem de texto (ignorar mensagens vazias/ok)
            if (message.body && message.body.trim().length > 0) {
                const userName = userState.data?.firstName || userState.data?.name || chatId;
                const forwardText = `👤 *Mensagem de ${userName}* (${chatId}):\n${message.body}`;
                try {
                    await globalThis.wppClient.sendText(attendantsGroupId, forwardText);
                } catch (err) {
                    console.error('Erro ao encaminhar mensagem para atendentes:', err.message);
                }
                // Atualiza métricas
                userState.data.metrics = userState.data.metrics || {};
                userState.data.metrics.messagesFromUser = (userState.data.metrics.messagesFromUser || 0) + 1;
                global.saveUserState(chatId, userState).catch(() => {});
                // Notifica dashboard
                broadcastEvent('message:forward', { chatId, message: message.body, timestamp: new Date().toISOString() });
            }
            // Se a mensagem contém mídia, avise o grupo sobre o anexo
            if (message.hasMedia) {
                const userName = userState.data?.firstName || userState.data?.name || chatId;
                try {
                    await globalThis.wppClient.sendText(attendantsGroupId, `📂 *${userName} (${chatId}) enviou um anexo.*`);
                } catch (err) {
                    console.error('Erro ao notificar anexo:', err.message);
                }
                // Notifica dashboard sem incrementar contagem de mensagens
                broadcastEvent('message:forward', { chatId, message: '[media]', timestamp: new Date().toISOString() });
            }
        }

        return {
            response: `👨‍💼 *Fila de Atendimento Humano*\n\n📍 Sua posição: *${position}º na fila*\n⏰ Tempo estimado: *${waitTime}*\n\n⏳ Aguarde, em breve um atendente estará disponível.\n\n💡 *Opções:*\n• Digite *"sair"* para voltar ao menu principal\n• Aguarde sua vez para ser atendido`,
            newStep: 'transfer_to_human',
            data: {
                ...userState.data,
                queuePosition: position
            }
        };
    }

    // =========================
    // FLUXO DE CHAT HUMANO DIRETO
    // =========================
    /**
     * Quando o usuário já está em atendimento humano (passo 'in_human_chat'),
     * qualquer mensagem enviada será encaminhada diretamente para o grupo ou contato de atendentes.
     * O usuário pode encerrar o atendimento digitando palavras-chave como "sair", "encerrar" ou "fim".
     */
    static async handleHumanChat(message, userState) {
        const chatId = message.from;
        const attendantsGroupId = process.env.ATTENDANTS_GROUP_ID;
        const attendantPhone = process.env.ATTENDANT_PHONE;
        const normalized = this.normalizeText(message.body || '');

        // Se o usuário deseja encerrar o atendimento humano
        if (['sair', 'encerrar', 'fim', 'obrigado', 'tchau'].includes(normalized)) {
            // Remove da fila se ainda estiver presente
            if (global.humanQueue && Array.isArray(global.humanQueue)) {
                global.humanQueue = global.humanQueue.filter((id) => id !== chatId);
            }
            // Atualiza métricas de fim de chat
            userState.data = userState.data || {};
            userState.data.metrics = userState.data.metrics || {};
            userState.data.metrics.chatEndTime = new Date().toISOString();
            await global.saveUserState(chatId, userState);
            // Notifica dashboard
            broadcastEvent('queue:leave', { chatId, timestamp: new Date().toISOString(), reason: 'chat_end' });
            return {
                response: '🙏 *Atendimento encerrado.*\n\nFoi um prazer ajudar você hoje. Se precisar de algo no futuro, estaremos sempre aqui!\n\n✨ Até mais! 👋',
                newStep: 'start',
                finalizeSession: true,
                data: userState.data
            };
        }

        // Encaminha mensagem para o grupo de atendentes ou contato designado
        const userName = userState.data?.firstName || userState.data?.name || chatId;
        const forwardText = message.body && message.body.trim().length > 0
            ? `💬 *Mensagem de ${userName}* (${chatId}):\n${message.body}`
            : null;
        try {
            if (forwardText) {
                if (attendantsGroupId && globalThis.wppClient) {
                    await globalThis.wppClient.sendText(attendantsGroupId, forwardText);
                } else if (attendantPhone && globalThis.wppClient) {
                    await globalThis.wppClient.sendText(attendantPhone, forwardText);
                }
                // Atualiza métricas
                userState.data.metrics = userState.data.metrics || {};
                // Define início do chat humano se ainda não tiver
                if (!userState.data.metrics.humanChatStartTime) {
                    userState.data.metrics.humanChatStartTime = new Date().toISOString();
                }
                userState.data.metrics.messagesFromUser = (userState.data.metrics.messagesFromUser || 0) + 1;
                await global.saveUserState(chatId, userState);
                // Notifica dashboard
                broadcastEvent('message:forward', { chatId, message: message.body, timestamp: new Date().toISOString() });
            }
            if (message.hasMedia && globalThis.wppClient) {
                // Notifica sobre anexo; futuramente pode encaminhar o arquivo
                if (attendantsGroupId) {
                    await globalThis.wppClient.sendText(attendantsGroupId, `📂 *${userName} (${chatId}) enviou um anexo durante o atendimento.*`);
                } else if (attendantPhone) {
                    await globalThis.wppClient.sendText(attendantPhone, `📂 *${userName} (${chatId}) enviou um anexo durante o atendimento.*`);
                }
                broadcastEvent('message:forward', { chatId, message: '[media]', timestamp: new Date().toISOString() });
            }
        } catch (err) {
            console.error('Erro ao encaminhar mensagem no atendimento humano:', err.message);
        }

        return {
            response: '✅ Sua mensagem foi encaminhada ao atendente. Aguarde a resposta.',
            newStep: 'in_human_chat',
            data: userState.data
        };
    }

    // =========================
    // FLUXO DE ÁUDIO
    // =========================
    static async handleAudioMessage(message, userState) {
        const attendantsGroupId = process.env.ATTENDANTS_GROUP_ID;
        let transcript = null;
        let detectedIntent = null;
        let tempFilePath = null;

        try {
            // Baixa o áudio
            const media = await message.downloadMedia();
            if (!media) throw new Error('Falha ao baixar o áudio');
            
            const ext = media.mimetype.split('/')[1] || 'ogg';
            const fileName = `audio-${Date.now()}.${ext}`;
            tempFilePath = path.join('./uploads/', fileName);
            fs.writeFileSync(tempFilePath, media.data, { encoding: 'base64' });

            // Simulação de transcrição (aqui você integraria com Whisper ou outro serviço)
            transcript = '[Áudio recebido - transcrição não implementada]';

            // Log do áudio
            fs.appendFileSync('./logs/audio-messages.log', JSON.stringify({
                timestamp: new Date().toISOString(),
                from: message.from,
                file: tempFilePath,
                transcript: transcript,
                note: 'Áudio processado'
            }) + '\n');

        } catch (err) {
            transcript = '[Erro ao transcrever o áudio: ' + err.message + ']';
            
            fs.appendFileSync('./logs/audio-messages.log', JSON.stringify({
                timestamp: new Date().toISOString(),
                from: message.from,
                error: err.message,
                note: 'Erro ao processar áudio'
            }) + '\n');
        }

        // Notifica grupo de atendentes
        if (attendantsGroupId && globalThis.wppClient && transcript) {
            let msg = `🔎 *Transcrição automática de áudio do cliente* (${message.from}):\n\n"${transcript}"`;
            try {
                await globalThis.wppClient.sendText(attendantsGroupId, msg);
            } catch (e) {
                console.error('Erro ao notificar grupo:', e.message);
            }
        }

        // Analisa intenção do áudio (palavras-chave simples)
        if (transcript) {
            const t = transcript.toLowerCase();
            if (t.includes('quebrado') || t.includes('trincado') || t.includes('defeito') || t.includes('produto') || t.includes('não funciona')) {
                detectedIntent = 'product_issue';
            }
        }

        // Se detectou problema com produto, inicia fluxo
        if (detectedIntent === 'product_issue') {
            return {
                response: '📋 *Registro de Problema com Produto*\n\nDetectamos que você está relatando um problema com seu produto. Para agilizar seu atendimento, por favor envie:\n\n1️⃣ *Nota fiscal ou número do pedido*\n(Você pode enviar uma foto da nota fiscal ou apenas digitar o número).',
                newStep: 'product_issue_nf',
                data: {
                    ...userState.data,
                    flowType: 'product_issue',
                    audioTranscript: transcript
                }
            };
        }

        // Caso não detecte intenção clara
        return {
            response: 'Recebemos seu áudio! Em breve um atendente irá analisar sua mensagem e te responder. Se quiser agilizar, pode digitar sua dúvida ou escolher uma opção do menu.',
            newStep: userState.step || 'start',
            data: {
                ...userState.data,
                audioTranscript: transcript
            }
        };
    }

    // =========================
    // FUNÇÕES UTILITÁRIAS
    // =========================
    
    // Utilitário: gera resumo do carrinho
    static formatCart(cart = []) {
        if (!cart.length) return '🛒 Seu carrinho está vazio.';
        let txt = '*🛒 Seu Carrinho:*\n';
        cart.forEach((item, i) => {
            txt += `*${i+1}*. ${item.name} — ${item.qty} un.\n`;
        });
        return txt;
    }

    // LOGGING CENTRALIZADO
    static logEvent(type, chatId, step, data = {}) {
        const logLine = JSON.stringify({
            timestamp: new Date().toISOString(),
            type,
            chatId,
            step,
            data
        }) + '\n';
        fs.appendFile('./logs/whatsapp-bot.log', logLine, err => {
            if (err) console.error('Erro ao gravar log:', err.message);
        });
    }

    // Recuperação de carrinho (persistência simples por usuário)
    static getCartFromStorage(chatId) {
        const file = `./userStates/${chatId}-cart.json`;
        if (fs.existsSync(file)) {
            try {
                return JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (e) { return []; }
        }
        return [];
    }

    static saveCartToStorage(chatId, cart) {
        if (!fs.existsSync('./userStates')) fs.mkdirSync('./userStates');
        fs.writeFileSync(`./userStates/${chatId}-cart.json`, JSON.stringify(cart));
    }
}

// =========================
// VARIÁVEIS GLOBAIS
// =========================
let wppClient = null;
let isReady = false;
let qrCodeString = '';
let messageLog = [];
const MAX_LOG_SIZE = 100;

// =========================
// FUNÇÕES DE SUPORTE
// =========================

// Função para adicionar mensagem ao log
function addToMessageLog(messageData) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        from: messageData.from,
        body: messageData.body,
        type: messageData.type,
        sentToBot: true
    };
    messageLog.unshift(logEntry);
    if (messageLog.length > MAX_LOG_SIZE) messageLog.pop();
}

// Logger detalhado para auditoria
function logEvent(event, details = {}) {
    try {
        const entry = {
            timestamp: new Date().toISOString(),
            event,
            ...details
        };
        const logFile = path.join(__dirname, 'logs', 'event.log');
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (e) {
        console.error('Erro ao registrar evento:', e);
    }
}

// =========================
// PERSISTÊNCIA DE ESTADO DO USUÁRIO
// =========================
// =========================
// PERSISTÊNCIA DE ESTADO DO USUÁRIO
// =========================
/**
 * Carrega o estado de um usuário. Se o banco de dados Postgres estiver configurado,
 * utiliza a tabela user_states; caso contrário, lê um arquivo JSON local.
 * @param {string} userId Identificador do usuário
 */
global.loadUserState = async function(userId) {
    // Se conexão Postgres está disponível, tenta carregar do BD
    if (dbPool) {
        try {
            const res = await dbPool.query('SELECT state FROM user_states WHERE user_id = $1', [userId]);
            if (res.rows.length > 0) {
                return res.rows[0].state;
            }
        } catch (err) {
            console.error(`Erro ao carregar estado do usuário ${userId} do PostgreSQL:`, err.message);
            if (Sentry) Sentry.captureException(err);
        }
    }
    // Fallback: JSON local
    const file = path.join(USER_STATE_DIR, `${userId}.json`);
    if (fs.existsSync(file)) {
        try {
            const data = fs.readFileSync(file, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`Erro ao carregar estado do usuário ${userId} do arquivo:`, e);
            structuredLog('error_load_user_state', { userId, error: e.message });
            return { step: 'start', data: {} };
        }
    }
    return { step: 'start', data: {} };
};

/**
 * Salva o estado de um usuário. Se o banco de dados Postgres estiver configurado,
 * persiste na tabela user_states; caso contrário, escreve um arquivo JSON local.
 * @param {string} userId Identificador do usuário
 * @param {object} state Objeto de estado
 */
global.saveUserState = async function(userId, state) {
    // Persiste lastInteraction em ISO string se não existir
    if (state && state.data) {
        state.data.lastInteraction = new Date().toISOString();
    }
    if (dbPool) {
        try {
            await dbPool.query(
                'INSERT INTO user_states (user_id, state) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state',
                [userId, state]
            );
            return;
        } catch (err) {
            console.error(`Erro ao salvar estado do usuário ${userId} no PostgreSQL:`, err.message);
            if (Sentry) Sentry.captureException(err);
        }
    }
    // Fallback: salva em arquivo JSON
    const file = path.join(USER_STATE_DIR, `${userId}.json`);
    try {
        fs.writeFileSync(file, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error(`Erro ao salvar estado do usuário ${userId} no arquivo:`, e.message);
        structuredLog('error_save_user_state', { userId, error: e.message });
    }
};

// =========================
// CLASSES DE GERENCIAMENTO
// =========================

// Gerenciador de grupos permitidos
class AllowedGroupsManager {
    constructor() {
        this.allowedGroups = new Set();
    }
    getAllowedGroups() {
        return Array.from(this.allowedGroups);
    }
    isGroupAllowed(groupId) {
        return this.allowedGroups.has(groupId);
    }
    addGroup(groupId, groupName = null) {
        this.allowedGroups.add(groupId);
        return true;
    }
    removeGroup(groupId) {
        return this.allowedGroups.delete(groupId);
    }
    getStats() {
        return {
            total: this.allowedGroups.size,
            groups: this.getAllowedGroups()
        };
    }
}

// Filtro de mensagens
const FILTER_CONFIG = {
    allowPrivateMessages: true,
    allowSpecificGroups: false,
    logBlockedMessages: false
};

class MessageFilter {
    constructor(allowedGroupsManager) {
        this.allowedGroupsManager = allowedGroupsManager;
        this.blockedCount = 0;
        this.allowedCount = 0;
        this.statusCount = 0;
    }
    shouldProcessMessage(message) {
        if (this.isStatusMessage(message)) {
            this.statusCount++;
            return false;
        }
        if (message.isGroupMsg) {
            if (FILTER_CONFIG.allowSpecificGroups && this.allowedGroupsManager.isGroupAllowed(message.chatId)) {
                this.allowedCount++;
                return true;
            }
            this.blockedCount++;
            return false;
        }
        if (FILTER_CONFIG.allowPrivateMessages && !message.isGroupMsg) {
            this.allowedCount++;
            return true;
        }
        this.blockedCount++;
        return false;
    }
    isStatusMessage(message) {
        if (!message?.chatId) return false;
        const statusPatterns = [/status@broadcast/i, /@broadcast/i, /status\.whatsapp\.net/i];
        return statusPatterns.some(pattern => pattern.test(message.chatId));
    }
    getStats() {
        const total = this.allowedCount + this.blockedCount + this.statusCount;
        return {
            total,
            allowed: this.allowedCount,
            blocked: this.blockedCount,
            status: this.statusCount,
            allowedPercentage: total > 0 ? ((this.allowedCount / total) * 100).toFixed(2) : 0,
            blockedPercentage: total > 0 ? ((this.blockedCount / total) * 100).toFixed(2) : 0,
            statusPercentage: total > 0 ? ((this.statusCount / total) * 100).toFixed(2) : 0
        };
    }
    resetStats() {
        this.allowedCount = 0;
        this.blockedCount = 0;
        this.statusCount = 0;
    }
}

// Monitoramento do sistema
class SystemMonitor {
    static getUptime() {
        return process.uptime();
    }
    static getMemoryUsage() {
        const mem = process.memoryUsage();
        return {
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external
        };
    }
    static getStats() {
        return {
            uptime: this.getUptime(),
            memory: this.getMemoryUsage(),
            timestamp: new Date().toISOString()
        };
    }
}

// Configuração dinâmica
class ConfigManager {
    static config = {
        atendimentoAtivo: true,
        horarioInicio: '08:00',
        horarioFim: '18:00'
    };
    static getConfig() {
        return this.config;
    }
    static updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.config;
    }
}

// Fila de atendimento
class SupportQueue {
    static queue = [];
    
    static addToQueue(chatId, data) {
        const entry = {
            chatId,
            data,
            timestamp: new Date().toISOString(),
            position: this.queue.length + 1
        };
        this.queue.push(entry);
        return entry.position;
    }
    
    static removeFromQueue(chatId) {
        this.queue = this.queue.filter(entry => entry.chatId !== chatId);
        this.updatePositions();
    }
    
    static updatePositions() {
        this.queue.forEach((entry, index) => {
            entry.position = index + 1;
        });
    }
    
    static getPosition(chatId) {
        const entry = this.queue.find(e => e.chatId === chatId);
        return entry ? entry.position : null;
    }
    
    static getDetailedQueueStatus() {
        return {
            total: this.queue.length,
            queue: this.queue,
            averageWaitTime: this.calculateAverageWaitTime()
        };
    }
    
    static calculateAverageWaitTime() {
        if (this.queue.length === 0) return 0;
        // Simulação: 5 minutos por pessoa
        return this.queue.length * 5;
    }
}

// =========================
// RATE LIMITING
// =========================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_MSG = 20;
const userRateLimit = new Map();

function isRateLimited(userId) {
    const now = Date.now();
    if (!userRateLimit.has(userId)) {
        userRateLimit.set(userId, { count: 1, start: now });
        return false;
    }
    const data = userRateLimit.get(userId);
    if (now - data.start > RATE_LIMIT_WINDOW_MS) {
        userRateLimit.set(userId, { count: 1, start: now });
        return false;
    }
    data.count++;
    return data.count > RATE_LIMIT_MAX_MSG;
}

// =========================
// INSTÂNCIAS
// =========================
const allowedGroupsManager = new AllowedGroupsManager();
const messageFilter = new MessageFilter(allowedGroupsManager);

// =========================
// INICIALIZAÇÃO DO WPPCONNECT
// =========================
async function initializeWPPConnect() {
    try {
        // Usa a variável de ambiente para o caminho do navegador, se definida
        const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        wppClient = await create({
            session: 'default',
            catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                qrCodeString = base64Qrimg;
                console.log('📱 QRCode gerado! Escaneie com seu WhatsApp.');
                console.log('📱 QRCode URL:', urlCode);
            },
            statusFind: (statusSession, session) => {
                console.log('Status da sessão:', statusSession);
            },
            headless: true,
            devtools: false,
            useChrome: true,
            debug: false,
            logQR: true,
            browserArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            puppeteerOptions: {
                userDataDir: './tokens/default'
            },
            autoClose: 60000,
            createPathFileToken: true,
            waitForLogin: true,
            ...(puppeteerExecutablePath ? { executablePath: puppeteerExecutablePath } : {})
        });

        // Definir cliente global
        globalThis.wppClient = wppClient;

        // Event: Conectado
        wppClient.onStateChange((state) => {
            if (state === 'CONNECTED') {
                isReady = true;
                qrCodeString = '';
                logEvent('wppconnect_connected');
                console.log('✅ WPPConnect conectado com sucesso!');
            } else if (state === 'DISCONNECTED') {
                isReady = false;
                logEvent('wppconnect_disconnected');
                console.log('🔌 WPPConnect desconectado!');
            }
        });

        // Event: Mensagem recebida
        wppClient.onMessage(async (message) => {
            try {
                // Ignorar mensagens próprias
                if (message.fromMe) return;

                // Segurança: rate limiting
                if (isRateLimited(message.from)) {
                    logEvent('rate_limited', { from: message.from, chatId: message.chatId });
                    await wppClient.sendText(message.from, '⚠️ Você está enviando mensagens muito rápido. Aguarde um momento.');
                    return;
                }

                // Filtro de mensagens
                if (!messageFilter.shouldProcessMessage(message)) {
                    logEvent('message_blocked', { from: message.from, chatId: message.chatId });
                    return;
                }

                // Log de mensagens
                addToMessageLog(message);
                logEvent('message_received', { 
                    from: message.from, 
                    chatId: message.chatId, 
                    type: message.type,
                    body: message.body?.substring(0, 100) 
                });

                // Carregar estado do usuário
                let userState = await global.loadUserState(message.from);

                // Processar mensagem através do fluxo conversacional
                const result = await ConversationFlow.processMessage(message, userState);

                // Salvar novo estado
                if (result.newStep) {
                    userState.step = result.newStep;
                    userState.data = result.data || {};
                    await global.saveUserState(message.from, userState);
                }

                // Finalizar sessão se solicitado
                if (result.finalizeSession) {
                    await global.saveUserState(message.from, { step: 'start', data: {} });
                }

                // Enviar resposta principal
                if (result.response) {
                    // Caso haja botões definidos pelo fluxo, tenta enviar uma mensagem interativa
                    if (result.buttons && Array.isArray(result.buttons) && result.buttons.length > 0) {
                        let sentInteractive = false;
                        // Primeiro tenta utilizar a API nativa de botões do WPPConnect, se existir
                        if (wppClient && typeof wppClient.sendButtons === 'function') {
                            try {
                                // Estrutura esperada pelo WPPConnect: array de objetos com id e texto
                                const buttonPayload = result.buttons.map((btn) => ({
                                    buttonId: btn.id || btn.text,
                                    buttonText: { displayText: btn.text },
                                    type: 1
                                }));
                            await wppClient.sendButtons(
                                    message.from,
                                    result.response,
                                    buttonPayload,
                                    'Selecione uma opção:',
                                    ''
                                );
                                sentInteractive = true;
                            } catch (e) {
                                console.warn('Falha ao enviar botões interativos:', e.message);
                            }
                        }
                        // Se não enviou via sendButtons, tenta enviar uma lista interativa
                        if (!sentInteractive && wppClient && typeof wppClient.sendListMessage === 'function') {
                            try {
                                const sections = [
                                    {
                                        title: 'Opções',
                                        rows: result.buttons.map((btn) => ({
                                            rowId: btn.id || btn.text,
                                            title: btn.text,
                                            description: ''
                                        }))
                                    }
                                ];
                                await wppClient.sendListMessage(message.from, {
                                    buttonText: 'Escolha uma opção',
                                    description: result.response,
                                    sections: sections
                                });
                                sentInteractive = true;
                            } catch (e) {
                                console.warn('Falha ao enviar lista interativa:', e.message);
                            }
                        }
                        // Fallback: envia como texto formatado com opções enumeradas
                        if (!sentInteractive) {
                            let menu = result.response + '\n';
                            result.buttons.forEach((btn) => {
                                menu += `\n${btn.id} - ${btn.text}`;
                            });
                            menu += '\nResponda com o número ou palavra-chave da opção desejada.';
                            await wppClient.sendText(message.from, menu);
                        }

                    } else {
                        // Sem botões: envia mensagem de texto simples
                        await wppClient.sendText(message.from, result.response);
                    }

                    // Após o envio da resposta principal, armazena a última resposta do bot para possíveis repetições
                    try {
                        if (result.response) {
                            userState.data = userState.data || {};
                            userState.data.lastBotResponse = result.response;
                            // Salva estado atualizado com última interação e lastBotResponse
                            await global.saveUserState(message.from, userState);
                        }
                    } catch (err) {
                        console.error('Erro ao atualizar lastBotResponse:', err.message);
                        if (Sentry) Sentry.captureException(err);
                    }
                }

                // Enviar mídia se configurada
                if (result.data?._sendMedia) {
                    const mediaConfig = result.data._sendMedia;
                    if (fs.existsSync(mediaConfig.file)) {
                        await wppClient.sendImage(
                            message.from,
                            mediaConfig.file,
                            'image',
                            mediaConfig.caption || ''
                        );
                    }
                }

                // Solicitar feedback de satisfação se configurado
                if (result.data?._sendFeedback) {
                    setTimeout(async () => {
                        await wppClient.sendText(
                            message.from,
                            '⭐ Como você avalia nosso atendimento?\n\nResponda de 1 a 5:\n\n1 - Muito Ruim 😠\n2 - Ruim 🙁\n3 - Regular 😐\n4 - Bom 🙂\n5 - Excelente 😄'
                        );
                        userState.step = 'awaiting_satisfaction_rating';
                        await global.saveUserState(message.from, userState);
                    }, 5000);
                }

                // Encaminhar para atendente humano
                if (result.forwardToAttendant) {
                    const attendantsGroupId = process.env.ATTENDANTS_GROUP_ID;
                    if (attendantsGroupId) {
                        const forwardMsg = `📨 *Nova mensagem para atendimento*\n\n` +
                            `👤 Cliente: ${userState.data?.name || 'Não identificado'}\n` +
                            `📱 WhatsApp: ${message.from}\n` +
                            `💬 Mensagem: ${message.body || '[mídia/arquivo]'}\n` +
                            `🕐 Horário: ${new Date().toLocaleString('pt-BR')}`;
                        
                        await wppClient.sendText(attendantsGroupId, forwardMsg);
                    }
                }

            } catch (err) {
                logEvent('error', { 
                    error: err.message, 
                    stack: err.stack,
                    from: message.from 
                });
                console.error('❌ Erro ao processar mensagem:', err);
                
                // Enviar mensagem de erro ao usuário
                try {
                    await wppClient.sendText(
                        message.from, 
                        '❌ Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente ou digite "menu" para voltar ao início.'
                    );
                } catch (sendErr) {
                    console.error('❌ Erro ao enviar mensagem de erro:', sendErr);
                }
            }
        });

        // Event: QR Code inválido
        wppClient.onIncomingCall(async (call) => {
            console.log('📞 Chamada recebida de:', call.peerJid);
            logEvent('incoming_call', { from: call.peerJid });
        });

        console.log('✅ WPPConnect inicializado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar WPPConnect:', error);
        logEvent('initialization_error', { error: error.message, stack: error.stack });
        throw error;
    }
}

// =========================
// ROTAS EXPRESS
// =========================

// Rota principal
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        ready: isReady,
        uptime: SystemMonitor.getUptime(),
        timestamp: new Date().toISOString()
    });
});

// QR Code
app.get('/qr', (req, res) => {
    if (!qrCodeString) {
        return res.status(404).json({ error: 'QR Code não disponível.' });
    }
    res.send(`
        <html>
            <head>
                <title>WhatsApp QR Code</title>
                <meta http-equiv="refresh" content="5">
                <style>
                    body { 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0;
                        background: #f0f0f0;
                    }
                    .container {
                        text-align: center;
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 0 20px rgba(0,0,0,0.1);
                    }
                    img { 
                        max-width: 300px; 
                        border: 2px solid #25D366;
                        border-radius: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>📱 Escaneie o QR Code</h2>
                    <img src="${qrCodeString}" alt="QR Code" />
                    <p>Abra o WhatsApp no seu celular e escaneie este código</p>
                </div>
            </body>
        </html>
    `);
});

// Métricas
app.get('/metrics', (req, res) => {
    res.json({
        system: SystemMonitor.getStats(),
        filter: messageFilter.getStats(),
        queue: SupportQueue.getDetailedQueueStatus(),
        config: ConfigManager.getConfig(),
        logSize: messageLog.length,
        isReady: isReady,
        timestamp: new Date().toISOString()
    });
});

// Status da fila
app.get('/queue-status', (req, res) => {
    res.json(SupportQueue.getDetailedQueueStatus());
});

// Grupos permitidos
app.get('/groups/allowed', (req, res) => {
    res.json(allowedGroupsManager.getStats());
});

app.post('/groups/allowed', (req, res) => {
    const { groupId } = req.body;
    if (!groupId) {
        return res.status(400).json({ error: 'groupId obrigatório' });
    }
    allowedGroupsManager.addGroup(groupId);
    res.json({ success: true });
});

app.delete('/groups/allowed/:groupId', (req, res) => {
    const removed = allowedGroupsManager.removeGroup(req.params.groupId);
    res.json({ success: removed });
});

// Log de mensagens
app.get('/messages/log', (req, res) => {
    res.json(messageLog);
});

// Estatísticas do filtro
app.get('/filter/stats', (req, res) => {
    res.json(messageFilter.getStats());
});

app.post('/filter/reset-stats', (req, res) => {
    messageFilter.resetStats();
    res.json({ success: true });
});

// Configuração
app.get('/config', (req, res) => {
    res.json(ConfigManager.getConfig());
});

app.post('/config', (req, res) => {
    const updated = ConfigManager.updateConfig(req.body);
    res.json(updated);
});

// Monitor do sistema
app.get('/system-monitor', (req, res) => {
    res.json(SystemMonitor.getStats());
});

// Logs de eventos
app.get('/logs/events', (req, res) => {
    const logFile = path.join(__dirname, 'logs', 'event.log');
    if (!fs.existsSync(logFile)) {
        return res.json([]);
    }
    
    const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
    const events = lines.slice(-200).map(line => {
        try {
            return JSON.parse(line);
        } catch {
            return null;
        }
    }).filter(Boolean);
    
    res.json(events.reverse());
});

// =========================
// ROTAS DE CARRINHO
// =========================

// Listar todos os carrinhos
app.get('/carts', async (req, res) => {
    try {
        const users = fs.readdirSync(USER_STATE_DIR).filter(f => f.endsWith('.json'));
        const carts = [];
        
        for (const file of users) {
            const userId = file.replace('.json', '');
            const userState = await global.loadUserState(userId);
            if (userState.data?.cart && userState.data.cart.length > 0) {
                carts.push({
                    userId,
                    userName: userState.data?.name || 'Não identificado',
                    cart: userState.data.cart,
                    total: userState.data.cart.reduce((sum, item) => sum + (item.qty || 0), 0)
                });
            }
        }
        
        res.json({
            total: carts.length,
            carts: carts
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ver carrinho específico
app.get('/cart/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userState = await global.loadUserState(userId);
        res.json({
            userId,
            userName: userState.data?.name || 'Não identificado',
            cart: userState.data?.cart || [],
            total: (userState.data?.cart || []).reduce((sum, item) => sum + (item.qty || 0), 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Adicionar item ao carrinho
app.post('/cart/:userId/add', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { name, qty } = req.body;
        
        if (!name || !qty) {
            return res.status(400).json({ error: 'Nome e quantidade são obrigatórios.' });
        }
        
        const userState = await global.loadUserState(userId);
        userState.data.cart = userState.data.cart || [];
        userState.data.cart.push({
            name,
            qty: parseInt(qty),
            addedAt: new Date().toISOString()
        });
        
        await global.saveUserState(userId, userState);
        res.json({
            success: true,
            cart: userState.data.cart
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remover item do carrinho
app.post('/cart/:userId/remove', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { index } = req.body;
        
        if (typeof index !== 'number') {
            return res.status(400).json({ error: 'Índice inválido.' });
        }
        
        const userState = await global.loadUserState(userId);
        
        if (!Array.isArray(userState.data.cart) || index < 0 || index >= userState.data.cart.length) {
            return res.status(400).json({ error: 'Índice fora do range ou carrinho vazio.' });
        }
        
        userState.data.cart.splice(index, 1);
        await global.saveUserState(userId, userState);
        
        res.json({
            success: true,
            cart: userState.data.cart
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Limpar carrinho
app.post('/cart/:userId/clear', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userState = await global.loadUserState(userId);
        userState.data.cart = [];
        await global.saveUserState(userId, userState);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Estatísticas dos carrinhos
app.get('/carts/stats', async (req, res) => {
    try {
        const users = fs.readdirSync(USER_STATE_DIR).filter(f => f.endsWith('.json'));
        let totalCarts = 0;
        let totalItems = 0;
        let totalQuantity = 0;
        
        for (const file of users) {
            const userId = file.replace('.json', '');
            const userState = await global.loadUserState(userId);
            if (userState.data?.cart && userState.data.cart.length > 0) {
                totalCarts++;
                totalItems += userState.data.cart.length;
                totalQuantity += userState.data.cart.reduce((sum, item) => sum + (item.qty || 0), 0);
            }
        }
        
        res.json({
            totalCarts,
            totalItems,
            totalQuantity,
            averageItemsPerCart: totalCarts > 0 ? (totalItems / totalCarts).toFixed(2) : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Exportar carrinhos em CSV
app.get('/carts/export/csv', async (req, res) => {
    try {
        const users = fs.readdirSync(USER_STATE_DIR).filter(f => f.endsWith('.json'));
        let csv = 'userId,userName,produto,quantidade,data\n';
        
        for (const file of users) {
            const userId = file.replace('.json', '');
            const userState = await global.loadUserState(userId);
            if (userState.data?.cart && userState.data.cart.length > 0) {
                for (const item of userState.data.cart) {
                    const userName = userState.data?.name || 'Não identificado';
                    const data = item.addedAt || new Date().toISOString();
                    csv += `"${userId}","${userName}","${item.name}",${item.qty},"${data}"\n`;
                }
            }
        }
        
        res.header('Content-Type', 'text/csv');
        res.attachment('carrinhos.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =========================
// ENVIO DE MENSAGENS VIA API
// =========================

// Enviar mensagem
app.post('/send-message', async (req, res) => {
    try {
        const { to, message } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: 'Destinatário e mensagem são obrigatórios.' });
        }
        
        if (!isReady || !wppClient) {
            return res.status(503).json({ error: 'WhatsApp não está conectado.' });
        }
        
        const result = await wppClient.sendText(to, message);
        res.json({
            success: true,
            messageId: result.id,
            to: result.to
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enviar imagem
app.post('/send-image', async (req, res) => {
    try {
        const { to, imageUrl, caption } = req.body;
        
        if (!to || !imageUrl) {
            return res.status(400).json({ error: 'Destinatário e URL da imagem são obrigatórios.' });
        }
        
        if (!isReady || !wppClient) {
            return res.status(503).json({ error: 'WhatsApp não está conectado.' });
        }
        
        const result = await wppClient.sendImage(to, imageUrl, 'image', caption || '');
        res.json({
            success: true,
            messageId: result.id,
            to: result.to
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =========================
// ENDPOINTS PARA INTEGRAÇÃO COM DASHBOARD
// =========================

/**
 * GET /queue
 * Retorna a lista de usuários na fila de atendimento humano, com posição e nome
 */
app.get('/queue', async (req, res) => {
    try {
        if (!global.humanQueue || !Array.isArray(global.humanQueue)) {
            return res.json({ queue: [] });
        }
        const result = [];
        for (let i = 0; i < global.humanQueue.length; i++) {
            const id = global.humanQueue[i];
            try {
                const userState = await global.loadUserState(id);
                result.push({
                    chatId: id,
                    position: i + 1,
                    name: userState.data?.name || userState.data?.firstName || null,
                    step: userState.step
                });
            } catch (err) {
                result.push({ chatId: id, position: i + 1, name: null, step: null });
            }
        }
        res.json({ queue: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /queue/remove
 * Remove um usuário da fila de atendimento humano
 * Body: { chatId: string }
 */
app.post('/queue/remove', (req, res) => {
    const { chatId } = req.body;
    if (!chatId) {
        return res.status(400).json({ error: 'chatId é obrigatório.' });
    }
    if (global.humanQueue && Array.isArray(global.humanQueue)) {
        global.humanQueue = global.humanQueue.filter((id) => id !== chatId);
    }
    res.json({ success: true });
});

/**
 * GET /user/:chatId/state
 * Retorna o estado salvo de um usuário específico
 */
app.get('/user/:chatId/state', async (req, res) => {
    const chatId = req.params.chatId;
    try {
        const state = await global.loadUserState(chatId);
        if (!state) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        res.json(state);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /user/:chatId/step
 * Atualiza o passo (step) e opcionalmente os dados (data) de um usuário específico.
 * Body: { step: string, data?: object }
 */
app.post('/user/:chatId/step', async (req, res) => {
    const chatId = req.params.chatId;
    const { step, data } = req.body;
    if (!step) {
        return res.status(400).json({ error: 'O campo "step" é obrigatório.' });
    }
    try {
        const state = await global.loadUserState(chatId) || { step: 'start', data: {} };
        state.step = step;
        if (data && typeof data === 'object') {
            state.data = { ...(state.data || {}), ...data };
        }
        await global.saveUserState(chatId, state);
        // Se remover do passo de atendimento, tira da fila
        if (step !== 'transfer_to_human' && global.humanQueue && Array.isArray(global.humanQueue)) {
            global.humanQueue = global.humanQueue.filter((id) => id !== chatId);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /events
 * Endpoint de Server-Sent Events para a dashboard receber atualizações em tempo real.
 * Exemplo de eventos enviados: queue:join, queue:leave, message:forward, message:attendant.
 */
app.get('/events', (req, res) => {
    // Configura headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Envia um ping inicial para iniciar a conexão
    res.write('event: ping\ndata: {}\n\n');
    const clientId = Date.now() + Math.random();
    const client = { id: clientId, res, connected: true };
    global.sseClients.push(client);
    req.on('close', () => {
        client.connected = false;
    });
});

/**
 * POST /attendant/send-message
 * Envia uma mensagem de um atendente específico para um usuário.
 * Body: { chatId: string, attendantId: string, message: string }
 * Também atualiza métricas e emite evento SSE.
 */
app.post('/attendant/send-message', async (req, res) => {
    const { chatId, attendantId, message } = req.body;
    if (!chatId || !attendantId || !message) {
        return res.status(400).json({ error: 'Os campos chatId, attendantId e message são obrigatórios.' });
    }
    if (!isReady || !wppClient) {
        return res.status(503).json({ error: 'WhatsApp não está conectado.' });
    }
    try {
        // Atualiza métricas (mensagens enviadas pelo atendente)
        try {
            const userState = await global.loadUserState(chatId) || { step: 'start', data: {} };
            userState.data.metrics = userState.data.metrics || {};
            userState.data.metrics.messagesToUser = (userState.data.metrics.messagesToUser || 0) + 1;
            await global.saveUserState(chatId, userState);
        } catch (_) {}
        const result = await wppClient.sendText(chatId, message);
        // Notifica dashboard via SSE
        broadcastEvent('message:attendant', { chatId, attendantId, message, timestamp: new Date().toISOString() });
        res.json({ success: true, messageId: result.id, to: result.to });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /admin/send-message
 * Permite a dashboard enviar uma mensagem proativa a um usuário. Pode ser utilizado
 * para notificações ou avisos personalizados. Corpo: { chatId: string, message: string }
 */
app.post('/admin/send-message', async (req, res) => {
    const { chatId, message } = req.body;
    if (!chatId || !message) {
        return res.status(400).json({ error: 'Os campos chatId e message são obrigatórios.' });
    }
    if (!isReady || !wppClient) {
        return res.status(503).json({ error: 'WhatsApp não está conectado.' });
    }
    try {
        // Atualiza métricas para mensagem enviada ao usuário
        try {
            const userState = await global.loadUserState(chatId) || { step: 'start', data: {} };
            userState.data.metrics = userState.data.metrics || {};
            userState.data.metrics.messagesToUser = (userState.data.metrics.messagesToUser || 0) + 1;
            userState.data.lastBotResponse = message;
            await global.saveUserState(chatId, userState);
        } catch (_) {}
        const result = await wppClient.sendText(chatId, message);
        // Notifica dashboard via SSE
        broadcastEvent('message:admin', { chatId, message, timestamp: new Date().toISOString() });
        structuredLog('admin_send_message', { chatId, message });
        return res.json({ success: true, messageId: result.id, to: result.to });
    } catch (error) {
        console.error('Erro em /admin/send-message:', error.message);
        if (Sentry) Sentry.captureException(error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /metrics/attendance
 * Retorna métricas de atendimento: tempos de espera, durações de chat e contagem de mensagens.
 */
app.get('/metrics/attendance', async (req, res) => {
    try {
        const users = fs.readdirSync(USER_STATE_DIR).filter(f => f.endsWith('.json'));
        const stats = [];
        let totalWait = 0;
        let totalChats = 0;
        let totalMessagesFromUser = 0;
        let totalMessagesToUser = 0;
        for (const file of users) {
            const chatId = file.replace('.json', '');
            const state = await global.loadUserState(chatId);
            const metrics = state.data?.metrics;
            if (metrics) {
                const waitTime = metrics.humanChatStartTime && metrics.queueEnterTime
                    ? new Date(metrics.humanChatStartTime).getTime() - new Date(metrics.queueEnterTime).getTime()
                    : null;
                const chatDuration = metrics.chatEndTime && metrics.humanChatStartTime
                    ? new Date(metrics.chatEndTime).getTime() - new Date(metrics.humanChatStartTime).getTime()
                    : null;
                totalMessagesFromUser += metrics.messagesFromUser || 0;
                totalMessagesToUser += metrics.messagesToUser || 0;
                if (waitTime !== null) {
                    totalWait += waitTime;
                }
                if (chatDuration !== null) {
                    totalChats += chatDuration;
                }
                stats.push({ chatId, waitTime, chatDuration, messagesFromUser: metrics.messagesFromUser || 0, messagesToUser: metrics.messagesToUser || 0 });
            }
        }
        const avgWait = stats.length > 0 ? (totalWait / stats.length) : 0;
        const avgChat = stats.length > 0 ? (totalChats / stats.length) : 0;
        res.json({
            count: stats.length,
            averageWaitTimeMs: Math.round(avgWait),
            averageChatDurationMs: Math.round(avgChat),
            totalMessagesFromUser,
            totalMessagesToUser,
            details: stats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =========================
// INICIALIZAÇÃO DO SISTEMA
// =========================
async function initializeSystem() {
    console.log('🚀 Inicializando sistema...');
    
    try {
        // Inicializar WPPConnect
        await initializeWPPConnect();
        
        // Inicializar banco de dados (se configurado)
        await initializeDatabase();

        // Log de inicialização bem-sucedida
        logEvent('system_initialized', {
            port: PORT,
            timestamp: new Date().toISOString()
        });

        // Agendar verificação de timeouts de sessão (a cada 5 minutos)
        const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '1800000'); // 30 minutos por padrão
        setInterval(async () => {
            try {
                await checkSessionTimeouts(SESSION_TIMEOUT_MS);
            } catch (err) {
                console.error('Erro ao verificar timeouts de sessão:', err.message);
                if (Sentry) Sentry.captureException(err);
            }
        }, 5 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ Erro na inicialização do sistema:', error);
        logEvent('system_initialization_failed', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
    logEvent('uncaught_exception', {
        error: error.message,
        stack: error.stack
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada não tratada:', reason);
    logEvent('unhandled_rejection', {
        reason: reason,
        promise: promise
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando servidor...');
    
    if (wppClient) {
        try {
            await wppClient.close();
            console.log('✅ WhatsApp desconectado');
        } catch (error) {
            console.error('❌ Erro ao desconectar WhatsApp:', error);
        }
    }
    
    process.exit(0);
});

// Iniciar o sistema
initializeSystem().catch((err) => {
    console.error('❌ Erro fatal na inicialização:', err);
    process.exit(1);
});

/**
 * Verifica sessões inativas e encerra automaticamente. Se um usuário ficar
 * inativo por mais de timeoutMs e não estiver no passo 'start', envia um
 * alerta de encerramento, zera o estado e atualiza a fila se necessário.
 * @param {number} timeoutMs Tempo limite em milissegundos
 */
async function checkSessionTimeouts(timeoutMs) {
    const now = Date.now();
    const threshold = now - timeoutMs;
    // Lista de usuários: se Postgres, busca todos IDs; se arquivo, lê diretórios
    let userIds = [];
    if (dbPool) {
        try {
            const res = await dbPool.query('SELECT user_id FROM user_states');
            userIds = res.rows.map(r => r.user_id);
        } catch (err) {
            console.error('Erro ao listar usuários para session timeout:', err.message);
            if (Sentry) Sentry.captureException(err);
        }
    } else {
        // Lê arquivos JSON na pasta USER_STATE_DIR
        userIds = fs.readdirSync(USER_STATE_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    }
    for (const userId of userIds) {
        try {
            const state = await global.loadUserState(userId);
            const lastInteraction = state?.data?.lastInteraction ? new Date(state.data.lastInteraction).getTime() : null;
            if (lastInteraction && lastInteraction < threshold && state.step && state.step !== 'start') {
                // Envia mensagem de timeout
                if (isReady && wppClient) {
                    try {
                        await wppClient.sendText(userId, '⏰ Sua sessão foi encerrada por inatividade. Se precisar de ajuda, digite "oi" para começar novamente.');
                    } catch (err) {
                        console.error('Erro ao enviar aviso de timeout para', userId, err.message);
                    }
                }
                structuredLog('session_timeout', { userId, step: state.step });
                // Remove da fila se estiver
                if (global.humanQueue && Array.isArray(global.humanQueue)) {
                    global.humanQueue = global.humanQueue.filter(id => id !== userId);
                }
                // Reseta o estado
                const newState = { step: 'start', data: {} };
                await global.saveUserState(userId, newState);
                // Notifica dashboards
                broadcastEvent('queue:leave', { chatId: userId, timestamp: new Date().toISOString(), reason: 'timeout' });
            }
        } catch (err) {
            console.error('Erro ao processar timeout para usuário', userId, err.message);
            if (Sentry) Sentry.captureException(err);
        }
    }
}

// Exportar para uso em outros módulos
module.exports = {
    ConversationFlow,
    wppClient,
    app
};