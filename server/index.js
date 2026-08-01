require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const pedidosRouter = require('./routes/pedidos');
const corteRouter = require('./routes/corte');
const { authenticateToken } = require('./routes/auth');

const http = require('http');
const { Server } = require('socket.io');

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { getCorporateEmailTemplate } = require('./utils/emailTemplate');
const mysqlService = require('./services/mysqlService');
const { calcularKPIMeuCanal } = require('./routes/meucanal');
const { sendText: waSend, logEmailSent, msgMeuCanal } = require('./services/whatsapp');
const whatsappAiAgent = require('./services/whatsappAiAgent');

const app = express();
const PORT = process.env.PORT || 3000;

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
            'https://metalfisa.lynxems.com.br',
            'https://sincometal.metalfisa.com.br',
            'http://sincometal.metalfisa.com.br',
            'http://192.168.1.77:3001',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://192.168.1.167:5173'
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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
    const agentPath = path.resolve(__dirname, '../client/public/MetalFisa-Print-Agent.ems');
    if (!fs.existsSync(agentPath)) {
        return res.status(404).json({ error: 'MetalFisa-Print-Agent.ems não encontrado.' });
    }
    res.download(agentPath, 'MetalFisa-Print-Agent.ems');
});

// Protected API routes — require valid JWT token
app.use('/api', authenticateToken);

// Routes (all protected by auth middleware above)
app.use('/api/pedidos', pedidosRouter);
app.use('/api/corte', corteRouter);
app.use('/api/pedidos-status', require('./routes/pedidos_status'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/produtos', require('./routes/produtos'));
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

// VMI — Vendor Managed Inventory
app.use('/api/vmi', require('./routes/vmi'));
app.use('/api/vmi-pedidos', require('./routes/vmiPedidos'));

// WabTec — Escopos e Engenharia
app.use('/api/wabtec', require('./routes/wabtec'));

// WabTec — Estrutura de Datas (Solicitações / Forecast)
app.use('/api/wabtec-datas', require('./routes/wabtec_datas'));

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

// Serve static files from React app with cache control
app.use(express.static(path.join(__dirname, '../client/dist'), {
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
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
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

                const transporter = nodemailer.createTransport({
                    host: 'smtp.task.com.br',
                    port: 587,
                    secure: false,
                    auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
                    tls: { rejectUnauthorized: false }
                });

                if (user.email && cfg?.automations?.meu_canal_email_active !== false) {
                    const emailSubject = 'Meu Canal - Performance Diária do Setor';
                    await transporter.sendMail({
                        from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
                        to: user.email,
                        subject: emailSubject,
                        html: getCorporateEmailTemplate(bodyHtml)
                    });
                    logEmailSent({ recipients: [user.email], subject: emailSubject, body: bodyHtml }).catch(() => {});
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

    console.log(`📡 Acesso na rede: http://${serverIP}:${PORT}`);

    // DEBUG: Print all registered routes to console to verify loading
    console.log('\n🔍 [DEBUG] Rotas Registradas (Updated):');
    printRoutes(app);
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
