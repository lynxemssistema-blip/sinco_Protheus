require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const pedidosRouter = require('./routes/pedidos');
const { authenticateToken } = require('./routes/auth');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
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

    socket.on('disconnect', () => {
        console.log(`🔴 [Socket.io] Cliente desconectado: ${socket.id}`);
    });
});

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://192.168.1.77:3001',
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

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Auth — public routes (no token required)
app.use('/api/auth', require('./routes/auth'));

// Protected API routes — require valid JWT token
app.use('/api', authenticateToken);

// Routes (all protected by auth middleware above)
app.use('/api/pedidos', pedidosRouter);
app.use('/api/clients', require('./routes/clients'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/users', require('./routes/users'));

// PCPMetal AI Agent Routes
app.use('/api/pcpmetal', require('./routes/pcpmetal'));


console.log('🔄 [DEBUG] Montando rota /api/producao...');
app.use('/api/producao', require('./routes/producao'));
console.log('✅ [DEBUG] Rota /api/producao montada.');

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
app.use('/api/almoxarifado', require('./routes/almoxarifado'));
console.log('✅ [DEBUG] Rotas de Materiais montadas.');

// PCP - Exportação de Materiais
app.use('/api/pcp', require('./routes/pcpMaterials'));

// Production Route
console.log('🔄 [DEBUG] Montando rota /api/production...');
app.use('/api/production', require('./routes/production'));
console.log('✅ [DEBUG] Rota /api/production montada.');

// Compras Route (Solicitações e Pedidos de Compras)
app.use('/api/compras', require('./routes/compras'));

// Reports Route
app.use('/api/reports', require('./routes/reports'));

// Sales Notes Route (Ata Viva)
app.use('/api/sales/notes', require('./routes/sales_notes'));

// Sinco Route (Ordem de Serviço)
app.use('/api/sinco', require('./routes/sinco'));

// Sinco - Apontamento de Produção (OS)
app.use('/api/sinco-apontamento', require('./routes/sinco_apontamento'));

// SGQ Documents
app.use('/api/sgq-documents', require('./routes/sgq_documents'));

// AI Document Assistant & Import/Export
app.use('/api/ai', require('./routes/ai'));

// VMI — Vendor Managed Inventory
app.use('/api/vmi', require('./routes/vmi'));

// Aviso System — Static uploads (images, audio, files)
app.use('/uploads/avisos', express.static(path.join(__dirname, 'uploads/avisos'), { maxAge: '7d' }));
app.use('/api/avisos', require('./routes/avisos'));

// Rota de Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Explicit API 404 to avoid falling back to React
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API Route Not Found', path: req.originalUrl, method: req.method });
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
                    prefix = prefix.replace(/\?\$?$/, '');

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
