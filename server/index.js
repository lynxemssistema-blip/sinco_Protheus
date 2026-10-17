const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const pedidosRouter = require('./routes/pedidos');
const corteRouter = require('./routes/corte');
const { authenticateToken } = require('./routes/auth');
const { tenantMiddleware } = require('./middlewares/tenantMiddleware');

const http = require('http');
const { Server } = require('socket.io');

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { getCorporateEmailTemplate } = require('./utils/emailTemplate');
const mysqlService = require('./services/mysqlService');
const { calcularKPIMeuCanal } = require('./routes/meucanal');
const { sendMail } = require('./services/mailService');
const { sendText: waSend, logEmailSent, msgMeuCanal } = require('./services/whatsapp');
const whatsappAiAgent = require('./services/whatsappAiAgent');

const app = express();
const PORT = process.env.PORT || 3000;

// Global process error handlers to prevent crashes from transient socket terminations
process.on('uncaughtException', (err) => {
    console.error('⚠️ [PROCESS UNCAUGHT EXCEPTION]:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [PROCESS UNHANDLED REJECTION]:', reason);
});

const fs = require('fs');
const https = require('https');

let server;
const certPath = path.join(__dirname, 'certs', 'cert.pem');
const keyPath = path.join(__dirname, 'certs', 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
    server = https.createServer(options, app);
    console.log('🔒 [SECURITY] Servidor iniciando com HTTPS ativado (SSL/TLS)');
} else {
    server = http.createServer(app);
    console.log('⚠️ [SECURITY] Certificados SSL não encontrados. Iniciando em HTTP puro.');
}

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Tornar o "io" acessível dentro das rotas
app.set('io', io);

io.on('connection', (socket) => {
    console.log(`🟢 [Socket.io] Nova conexão estabelecida: ${socket.id}`);

    // O usuário entra em uma "sala" com seu próprio ID
    socket.on('join_user', (userId) => {
        if (userId) {
            socket.join(`usuario_${userId}`);
            console.log(`🟢 Usuário ${userId} entrou na sala do socket.`);
        }
    });

    // Sala da empresa (multi-tenant). O IdEmpresa vem do JWT validado, nunca do cliente.
    socket.on('join_tenant', (token) => {
        try {
            const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
            socket.join(`tenant_${decoded.IdEmpresa ?? 'global'}`);
        } catch {
            socket.emit('join_tenant_error', 'Token inválido');
        }
    });

    // Entrar em uma sala de grupo
    socket.on('join_group', (groupId) => {
        if (groupId) {
            socket.join(`grupo_${groupId}`);
            console.log(`🟢 Usuário ${socket.id} entrou no grupo_${groupId}`);
        }
    });

    // Sala do formulário SINCO (Solid Edge Desktop → Web)
    socket.on('join_sinco_formulario', () => {
        socket.join('sinco_formulario');
        console.log(`🟢 [SINCO] Cliente ${socket.id} entrou na sala sinco_formulario`);
    });

    // Sala de log em tempo real de uma tarefa Hermes específica
    socket.on('join_hermes_task', (taskId) => {
        if (taskId) {
            socket.join(`hermes_task_${taskId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔴 [Socket.io] Cliente desconectado: ${socket.id}`);
    });
});

app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.CORS_ORIGIN,
            'https://lynxems.com.br',
            'https://www.lynxems.com.br',
            'http://lynxems.com.br',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002'
        ].filter(Boolean);

        const isLocalOrLan = origin && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);

        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.lynxems.com.br') || isLocalOrLan) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origem não permitida: ${origin}`);
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-override'],
    credentials: true
}));

// Logging Middleware — reduced in production
const isProduction = process.env.NODE_ENV === 'production';
app.use((req, res, next) => {
    if (!isProduction) {
        console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
    }
    next();
});

// Compressão HTTP (gzip/deflate) para reduzir tráfego (JS/CSS/JSON)
// Não altera a funcionalidade; apenas muda o transporte quando o browser suporta.
app.use(compression());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check para o Watchdog e Monitoramento de Disponibilidade
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Redirecionamento transparente de /api/system para o Watchdog isolado (porta 3008)
app.use('/api/system', (req, res) => {
    const watchdogPort = process.env.WATCHDOG_PORT || 3008;
    const proxyReq = http.request({
        hostname: '127.0.0.1',
        port: watchdogPort,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${watchdogPort}` }
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
        if (req.method === 'GET' && (req.path === '/status' || req.originalUrl.includes('/system/status'))) {
            return res.json({
                online: true,
                latencyMs: 5,
                slow: false,
                cooldownRemainingMs: 0,
                canRestart: false,
                remainingMinutes: 0,
                timestamp: new Date().toISOString(),
                watchdogOnline: false
            });
        }
        res.status(503).json({ error: 'Watchdog offline', detail: err.message });
    });
    req.pipe(proxyReq);
});


// --- AI Error Tracker Middleware ---
const { handleSystemError } = require('./utils/errorHandlerToAgent');
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function(body) {
        if (res.statusCode >= 500) {
            handleSystemError(req, body).catch(e => console.error(e));
        }
        return originalJson.call(this, body);
    };
    next();
});

// Auth — public routes (no token required)
app.use('/api/auth', require('./routes/auth'));

// Multi-Tenant: Gestão de Usuários da Empresa e Planos
app.use('/api/empresa', require('./routes/empresaUsuarios'));

// Multi-Tenant: Painel do Superadmin e Impersonation (edsonmanoel2012@gmail.com)
app.use('/api/superadmin', require('./routes/superadmin'));

// SINCO Formulário Web — público (chamado pelo desktop Solid Edge sem autenticação)
let _dadosCorrenteSE = null;
app.post('/api/sinco/dados-correntes', (req, res) => {
    _dadosCorrenteSE = req.body;
    io.to('sinco_formulario').emit('sinco:desenho_atualizado', _dadosCorrenteSE);
    res.json({ ok: true });
});
app.get('/api/sinco/dados-correntes/conectados', (_req, res) => {
    const room = io.sockets.adapter.rooms.get('sinco_formulario');
    res.json({ conectados: room ? room.size : 0 });
});

// Public: RH Curriculo PDF downloads (opened via window.open, no token available)
const rhUploadDir = path.join(__dirname, 'uploads/rh_curriculos');
app.get('/api/rh/curriculos/download/:filename', (req, res) => {
    const filename = req.params.filename;
    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Nome de arquivo inválido.' });
    }
    const filePath = path.join(rhUploadDir, filename);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    res.download(filePath);
});

// ── Rota pública: download do Print Agent (sem auth — navegador não envia JWT em <a download>) ──
app.get('/api/labels/download-agent', (req, res) => {
    const fs = require('fs');
    const agentPath = path.resolve(__dirname, '../client/public/Lynx-Print-Agent.ems');
    if (!fs.existsSync(agentPath)) {
        return res.status(404).json({ error: 'Lynx-Print-Agent.ems não encontrado.' });
    }
    res.download(agentPath, 'Lynx-Print-Agent.ems');
});

// Protected API routes — require valid JWT token and inject tenant context
app.use('/api', authenticateToken);
app.use('/api', tenantMiddleware);

// Routes (all protected by auth middleware above)
app.use('/api/pedidos', pedidosRouter);
app.use('/api/corte', corteRouter);
app.use('/api/pedidos-status', require('./routes/pedidos_status'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/msmetal', require('./routes/msmetal'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/users', require('./routes/users'));
const sgqRoutes = require('./routes/sgq');
app.use('/api/sgq/assets', require('./routes/sgq_assets'));
app.use('/api/sgq/romaneios', require('./routes/sgq_romaneios'));
app.use('/api/sgq/fornecedores', require('./routes/sgq_fornecedores'));
app.use('/api/sgq', sgqRoutes);
app.use('/api/protheus', require('./routes/protheus'));

// PCPMetal AI Agent Routes
app.use('/api/pcpmetal', require('./routes/pcpmetal'));

// Hermes AI Agent Routes
app.use('/api/hermes', require('./routes/hermes'));

// SINCO ERP Nativo (Módulo independente do Protheus)
app.use('/api/erp', require('./routes/erp'));


console.log('🔄 [DEBUG] Montando rota /api/producao...');
app.use('/api/producao', require('./routes/producao'));
app.use('/api/ind_pcp', require('./routes/ind_pcp'));
console.log('✅ [DEBUG] Rota /api/producao e /api/ind_pcp montadas.');

// Romaneios Route
app.use('/api/romaneios', require('./routes/romaneios'));

// Stock Route
app.use('/api/stock', require('./routes/stock'));

// Company Route
app.use('/api/company', require('./routes/company'));

// Propostas Comerciais (Módulo Exclusivo SuperAdmin)
app.use('/api/propostas', require('./routes/propostasComerciais'));

// Suíte de Módulos Corporativos (100% MySQL & Multi-Tenant)
app.use('/api/cadastros-basicos', require('./routes/cadastrosBasicos'));
app.use('/api/salas-reuniao', require('./routes/salasReuniao'));
app.use('/api/salas', require('./routes/salasReuniao'));
app.use('/api/reunioes', require('./routes/salasReuniao'));
app.use('/api/sst/brigada', require('./routes/sstBrigada'));
app.use('/api/sst', require('./routes/sst'));
app.use('/api/sst/cesta', require('./routes/sstCestaBasica'));
app.use('/api/rh/pasta', require('./routes/rhPastaColaborador'));
app.use('/api/rh/autoatendimento', require('./routes/rhAutoatendimento'));
app.use('/api/suporte', require('./routes/suporte'));
app.use('/api/sistema', require('./routes/backupConfig'));
app.use('/api/cipa', require('./routes/cipa'));
app.use('/api/portaria', require('./routes/portaria'));
app.use('/api/sst-brigada', require('./routes/sstBrigada'));

// Materials Management Routes
console.log('🔄 [DEBUG] Montando rota /api/materials...');
app.use('/api/materials', require('./routes/materials'));
app.use('/api/engineering-bom', require('./routes/engineering_bom'));
app.use('/api/engineering-releases', require('./routes/engineering_releases'));
app.use('/api/product-status', require('./routes/product_status'));
app.use('/api/pcp-releases', require('./routes/pcp_releases'));
app.use('/api/engineering-controls', require('./routes/engineering_controls'));
app.use('/api/engineering-timesheets', require('./routes/engineering_timesheets'));
app.use('/api/almoxarifado', require('./routes/almoxarifado'));
console.log('✅ [DEBUG] Rotas de Materiais montadas.');

// PCP - Exportação de Materiais
app.use('/api/pcp', require('./routes/pcpMaterials'));

// Labels — Impressão de Etiquetas PPLB/EPL2
app.use('/api/labels', require('./routes/labels'));

// Production Route
console.log('🔄 [DEBUG] Montando rota /api/production...');
app.use('/api/production', require('./routes/production'));
console.log('✅ [DEBUG] Rota /api/production montada.');

// Compras Route (Solicitações e Pedidos de Compras)
app.use('/api/compras', require('./routes/compras'));
app.use('/api/auditoria-pc', require('./routes/auditoriaPC'));

// Reports Route
app.use('/api/reports', require('./routes/reports'));

// PCP Setores — Cadastro de Setores, Recursos e Visão Gerencial
app.use('/api/pcp-setores', require('./routes/setores'));
app.use('/api/pcp/curva-s', require('./routes/curva-s'));


// Gestão Global de E-mails / SMTP / IMAP
app.use('/api/email', require('./routes/email'));

// Sales Notes Route (Ata Viva)
app.use('/api/sales/notes', require('./routes/sales_notes'));
app.use('/api/ata-viva', require('./routes/ataViva'));

// Sinco Route (Ordem de Serviço)
app.use('/api/sinco', require('./routes/sinco'));
// Cadastro/vínculo de produto no Protheus (formulário SolidEdge)
app.use('/api/produto-protheus', require('./routes/produtoProtheus'));
app.use('/api/faturamento/pre-etiquetas', require('./routes/etiquetasPreLista'));

// Sinco - Apontamento de Produção (OS)
app.use('/api/sinco-apontamento', require('./routes/sinco_apontamento'));

// SGQ Documents
app.use('/api/sgq-documents', require('./routes/sgq_documents'));

// RH (Recursos Humanos) module
app.use('/api/rh', require('./routes/rh'));

// AI Document Assistant & Import/Export
app.use('/api/ai', require('./routes/ai'));

// Protheus AI Study Catalog
app.use('/api/protheus-study', require('./routes/protheusStudy'));

// Expedição e Faturamento
app.use('/api/faturamento', require('./routes/faturamento'));

// Financeiro Dashboard
app.use('/api/financeiro', require('./routes/financeiro'));

// PCP Geral - Liberação e Execução de Programas por Máquina
app.use('/api/pcp/programas', require('./routes/pcpProgramas'));

// System Settings
app.use('/api/settings', require('./routes/system_settings'));

// PPAPs
app.use('/api/ppaps', require('./routes/ppaps'));

// Manutenção de Equipamentos
app.use('/api/manutencao', require('./routes/manutencao'));

// Monitoramento route
app.use('/api/monitoramento', require('./routes/monitoramento'));

// PCP Refinado route
app.use('/api/pcp-refinado', require('./routes/pcpRefinado'));

// Calendário de Atividades route
app.use('/api/calendario', require('./routes/calendario'));

// WinSCP
app.use('/api/winscp', require('./routes/winscp'));

// Recebimentos de NF (Suprimentos/Almoxarifado)
app.use('/api/nfe-recebimento', require('./routes/recebimentosNfe'));

const systemMonitor = require('./services/systemMonitor');
systemMonitor.startMonitoring(app);

// Meu Canal & KPIs
app.use('/api/meucanal', require('./routes/meucanal'));

// WhatsApp Logs
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Suporte IA Webhook (WhatsApp Evolution)
app.use('/api/webhook', require('./routes/webhook_suporte'));

// System Errors Tracking
app.use('/api/system-errors', require('./routes/systemErrors'));

// Aviso System — Static uploads (images, audio, files)
app.use('/uploads/avisos', express.static(path.join(__dirname, 'uploads/avisos'), { maxAge: '7d' }));
app.use('/uploads/conferencias', express.static(path.join(__dirname, 'uploads/conferencias'), { maxAge: '7d' }));
app.use('/uploads/romaneios', express.static(path.join(__dirname, 'uploads/romaneios'), { maxAge: '7d' }));
app.use('/uploads/certificados', express.static(path.join(__dirname, 'uploads/certificados'), { maxAge: '7d' }));
app.use('/uploads/sgq_ajuda', express.static(path.join(__dirname, 'uploads/sgq_ajuda'), { maxAge: '7d' }));
app.use('/uploads/whatsapp', express.static(path.join(__dirname, 'uploads/whatsapp'), { maxAge: '7d' }));
app.use('/uploads/checklists', express.static(path.join(__dirname, 'uploads/checklists'), { maxAge: '7d' }));
app.use('/uploads/portaria', express.static(path.join(__dirname, 'uploads/portaria'), { maxAge: '7d' }));
app.use('/api/avisos', require('./routes/avisos'));
app.use('/api/montagem', require('./routes/montagem'));

// Rota de Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Explicit API 404 to avoid falling back to React
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// Explicit Uploads 404 to avoid falling back to React
app.use('/uploads', (req, res) => {
    res.status(404).send('Arquivo não encontrado no servidor.');
});

// Detectar caminho do build do frontend (compatível com raiz ou subpastas)
const clientDistCandidates = [
    path.join(__dirname, '..'),           // Quando index.html está na raiz do public_html
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, 'client/dist'),
    path.join(__dirname, '../dist'),
    path.join(__dirname, 'dist'),
    path.join(__dirname, 'public')
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(__dirname, '../client/dist');
console.log(`📂 [Frontend Static] Servindo arquivos do cliente a partir de: ${clientDistPath}`);

// Serve static files from React app with cache control
app.use(express.static(clientDistPath, {
    maxAge: '1d', // Assets com hash no nome podem ser cacheados por 1 dia
    setHeaders: (res, filePath) => {
        // HTML nunca deve ser cacheado para garantir última versão
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// SPA fallback com cache-control para garantir última versão
app.get(/(.*)/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(clientDistPath, 'index.html'));
});


// ==========================================
// CRON JOB - AGENTE DE IA MONITORAMENTO WHATSAPP
// ==========================================
cron.schedule('0 15 * * *', async () => {
    try {
        const { isWeekendOrHoliday } = require('./utils/dateHelper');
        if (isWeekendOrHoliday()) {
            console.log('[CRON] Hoje é final de semana ou feriado. Relatório diário do Agente de IA para WhatsApp pulado.');
            return;
        }
        const [configRows] = await mysqlService.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        let cfg = null;
        if (configRows.length && configRows[0].general_config) {
            cfg = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
        }
        if (cfg?.automations?.ai_whatsapp_active === false) {
            console.log('[CRON] Agente de IA para WhatsApp desativado nas configurações globais.');
            return;
        }
        console.log('[CRON] Iniciando relatório diário do Agente de IA para WhatsApp...');
        const [groups] = await mysqlService.query(
            'SELECT grupo_nome, grupo_jid FROM app_whatsapp_grupos_monitorados WHERE grupo_jid IS NOT NULL'
        );
        for (const group of groups) {
            try {
                await whatsappAiAgent.sendDailySummaryToGroup(group.grupo_nome, group.grupo_jid);
            } catch (groupErr) {
                console.error(`[CRON WhatsApp AI] Falha ao processar grupo "${group.grupo_nome}":`, groupErr.message);
            }
        }
    } catch (err) {
        console.error('[CRON WhatsApp AI] Erro geral ao executar rotina:', err.message);
    }
});


// ==========================================
// CRON JOBS AUTOMATIZADOS - MEU CANAL
// ==========================================
cron.schedule('0 6,15 * * *', async () => {
    try {
        const { isWeekendOrHoliday } = require('./utils/dateHelper');
        if (isWeekendOrHoliday()) {
            console.log('[CRON] Hoje é final de semana ou feriado. Rotina de Meu Canal pulada.');
            return;
        }
        const [configRows] = await mysqlService.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        let cfg = null;
        if (configRows.length && configRows[0].general_config) {
            cfg = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
            if (cfg?.automations?.meu_canal_active === false && cfg?.automations?.meu_canal_email_active === false) {
                console.log('[CRON] Rotina de Meu Canal desativada (WhatsApp e E-mail) nas configurações globais.');
                return;
            }
        }
        console.log('[CRON] Iniciando rotina de disparo de e-mails/WhatsApp Meu Canal...');
        const [respRows] = await mysqlService.query(`
            SELECT DISTINCT u.idUsuario as id, u.Login, u.NomeCompleto, u.email, u.whatsapp
            FROM pcp_setor_responsaveis sr
            JOIN usuario u ON u.idUsuario = sr.usuario_id
        `);

        for (const user of respRows) {
            if (!user.email && !user.whatsapp) continue;

            try {
                const kpiData = await calcularKPIMeuCanal(user.id, user.Login, user.NomeCompleto);
                
                let bodyHtml = `
                    <div style="padding: 10px; font-family: sans-serif;">
                        <h2 style="color: #0d9488; margin-bottom: 5px;">Performance do Setor</h2>
                        <p style="color: #475569; font-size: 14px;">Olá, <b>${user.NomeCompleto || user.Login}</b>. Resumo de hoje:</p>
                        <table style="width: 100%; max-width: 600px; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="background-color: #f1f5f9; text-align: left;">
                                    <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Setor</th>
                                    <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: center;">Evolução</th>
                                    <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: center;">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                for (const setor of kpiData.setores) {
                    const emoji = setor.score >= 90 ? '✅' : setor.score >= 60 ? '⚠️' : '❌';
                    bodyHtml += `
                                <tr>
                                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${emoji} ${setor.nome}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${setor.producaoRealizada ?? 0} / ${setor.producaoPlanejada ?? 0}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${setor.cor};">${setor.score}%</td>
                                </tr>
                    `;
                }

                bodyHtml += `
                            </tbody>
                        </table>
                    </div>
                `;

                bodyHtml += `</div>`;

                if (user.email && cfg?.automations?.meu_canal_email_active !== false) {
                    const emailSubject = 'Meu Canal - Performance Diária do Setor';
                    try {
                        await sendMail({
                            to: user.email,
                            subject: emailSubject,
                            html: getCorporateEmailTemplate(bodyHtml)
                        });
                        logEmailSent({ recipients: [user.email], subject: emailSubject, body: bodyHtml }).catch(() => {});
                    } catch (mErr) {
                        console.error('[SMTP OFICIAL] Erro ao enviar Meu Canal email:', mErr.message);
                    }
                }

                if (user.whatsapp && cfg?.automations?.meu_canal_active !== false) {
                    const waText = msgMeuCanal({
                        nome: user.NomeCompleto || user.Login,
                        setores: kpiData.setores
                    });
                    await waSend(user.whatsapp, waText, 'Meu Canal - Performance Diária').catch(e =>
                        console.error('[CRON Meu Canal] Erro WhatsApp para', user.Login, e.message)
                    );
                }

            } catch (err) {
                console.error('[CRON Meu Canal] Erro ao enviar para', user.Login, err);
            }
        }
        console.log('[CRON] Rotina de Meu Canal finalizada com sucesso.');
    } catch (err) {
        console.error('[CRON] Erro geral na rotina:', err);
    }
});

const { init: startSgqAlertsJob } = require('./services/cronJobs/sgqAlertsJob');
startSgqAlertsJob();

const { startBackupCron } = require('./services/cronJobs/backupDbJob');
startBackupCron();

const { startFaturamentoCron } = require('./services/faturamentoCron');
startFaturamentoCron();

const { init: startFaturamentoEmailJob } = require('./services/cronJobs/faturamentoEmailJob');
startFaturamentoEmailJob();

const { startHermesScheduler } = require('./services/hermes/scheduler');
startHermesScheduler();

const { startProactiveMonitor, setSocketIo } = require('./services/hermes/proactiveCron');
setSocketIo(io);
startProactiveMonitor();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);

    // Find the first non-internal IPv4 address
    const interfaces = require('os').networkInterfaces();
    let serverIP = 'localhost';

    Object.keys(interfaces).forEach((ifname) => {
        interfaces[ifname].forEach((iface) => {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4
                return;
            }
            serverIP = iface.address;
        });
    });

    // Sincroniza dados nativos do ERP para compatibilidade com rotas Protheus (SC5, SC6, SA1, SB1)
    const { syncErpToProtheus } = require('./scripts/sync_erp_to_protheus');
    syncErpToProtheus().catch(e => console.warn('⚠️ [SYNC] Falha ao sincronizar ERP -> Protheus:', e.message));
});

function printRoutes(app) {
    // Safety check for _router
    if (!app._router || !app._router.stack) {
        console.log('⚠️ Unable to print routes - router not initialized');
        return;
    }

    const table = [];
    app._router.stack.forEach(middleware => {
        if (middleware.route) { // routes registered directly on the app
            table.push({ method: Object.keys(middleware.route.methods).join(', ').toUpperCase(), path: middleware.route.path });
        } else if (middleware.name === 'router') { // router middleware 
            middleware.handle.stack.forEach(handler => {
                let route = handler.route;
                if (route) {
                    // Try to guess the prefix by matching the regex
                    // This is rough but enough for debug
                    let prefix = middleware.regexp.source
                        .replace('^\\', '')
                        .replace('\\/?(?=\\/|$)', '')
                        .replace(/\\\//g, '/')
                        .replace('(?:\\/)?$', '')
                        .replace(/\^/g, '')
                        .replace(/\\\//g, '/');

                    // Cleanup common regex artifacts
                    prefix = prefix.replace(new RegExp('/?$'), '');

                    table.push({
                        method: Object.keys(route.methods).join(', ').toUpperCase(),
                        path: prefix + route.path
                    });
                }
            });
        }
    });
    if (table.length > 0) {
        console.table(table);
    } else {
        console.log('✅ Server routes loaded successfully');
    }
}

// Trigger nodemon restart

// Trigger nodemon restart 2

// trigger restart
