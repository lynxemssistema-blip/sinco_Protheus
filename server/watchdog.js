/**
 * MetalFisa System Watchdog
 * Microserviço autônomo e isolado em Node.js puro.
 * - Zero dependências externas (apenas módulos nativos do Node).
 * - Monitora a saúde do backend principal.
 * - Permite reinício seguro sob demanda com Cooldown estrito de 30 minutos.
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const WATCHDOG_PORT = process.env.WATCHDOG_PORT || 3008;
const MAIN_PORT = process.env.PORT || (process.platform === 'win32' ? 3002 : 3001);
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos
const STATE_FILE = path.join(__dirname, 'watchdog_state.json');

// Carrega estado persistido do último reinício
let lastRestartTimestamp = 0;
try {
    if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        lastRestartTimestamp = data.lastRestartTimestamp || 0;
    }
} catch (e) {
    console.warn('[Watchdog] Aviso ao ler estado persistido:', e.message);
}

function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            lastRestartTimestamp,
            lastUpdated: new Date().toISOString()
        }, null, 2));
    } catch (e) {
        console.error('[Watchdog] Erro ao salvar estado:', e.message);
    }
}

// Checa saúde do processo principal
function checkMainHealth() {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const req = http.get({
            hostname: '127.0.0.1',
            port: MAIN_PORT,
            path: '/api/health',
            timeout: 3000
        }, (res) => {
            const latencyMs = Date.now() - startTime;
            resolve({
                online: res.statusCode >= 200 && res.statusCode < 400,
                statusCode: res.statusCode,
                latencyMs
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ online: false, reason: 'TIMEOUT', latencyMs: Date.now() - startTime });
        });

        req.on('error', (err) => {
            resolve({ online: false, reason: err.code || err.message, latencyMs: Date.now() - startTime });
        });
    });
}

// Executa comando de restart conforme a plataforma
function triggerRestart() {
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            // Ambiente de desenvolvimento Windows
            console.log('[Watchdog] Executando comando de restart local Windows...');
            exec('npx pm2 restart all || node -e "process.exit(0)"', { cwd: __dirname }, (error, stdout, stderr) => {
                resolve({ stdout: stdout || 'Comando Windows executado', stderr });
            });
        } else {
            // Servidor Linux de Produção (PM2)
            console.log('[Watchdog] Executando pm2 restart metalfisa_producao...');
            exec('pm2 restart metalfisa_producao || pm2 restart all', { cwd: __dirname }, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Watchdog] Erro ao reiniciar PM2:', error);
                    return resolve({ error: error.message, stdout, stderr });
                }
                resolve({ stdout, stderr });
            });
        }
    });
}

const server = http.createServer(async (req, res) => {
    // Configura headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${WATCHDOG_PORT}`);

    // Endpoint 1: Status & Latência do Servidor
    if (url.pathname === '/api/system/status' && req.method === 'GET') {
        const health = await checkMainHealth();
        const now = Date.now();
        const timeSinceLastRestart = now - lastRestartTimestamp;
        const cooldownRemainingMs = Math.max(0, COOLDOWN_MS - timeSinceLastRestart);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            online: health.online,
            latencyMs: health.latencyMs,
            slow: health.latencyMs > 3000 || !health.online,
            cooldownRemainingMs,
            canRestart: cooldownRemainingMs === 0,
            remainingMinutes: Math.ceil(cooldownRemainingMs / 60000),
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Endpoint 2: Acordar / Reiniciar o Servidor
    if (url.pathname === '/api/system/wake-up' && req.method === 'POST') {
        const now = Date.now();
        const timeSinceLastRestart = now - lastRestartTimestamp;

        // Validação estrita do Cooldown de 30 minutos
        if (timeSinceLastRestart < COOLDOWN_MS) {
            const remainingMs = COOLDOWN_MS - timeSinceLastRestart;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'COOLDOWN_ACTIVE',
                message: `O servidor foi reiniciado recentemente. Aguarde mais ${remainingMinutes} minuto(s) para nova tentativa.`,
                remainingMinutes,
                remainingMs
            }));
            return;
        }

        console.log(`[Watchdog] ⚡ Requisição de reinício recebida às ${new Date().toISOString()}`);
        
        // Atualiza timestamp e salva estado
        lastRestartTimestamp = now;
        saveState();

        // Dispara reinício em background
        triggerRestart().then((output) => {
            console.log('[Watchdog] Saída do restart:', output.stdout);
        }).catch((err) => {
            console.error('[Watchdog] Falha no restart:', err);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'Comando de reinício do servidor disparado com sucesso!',
            etaSeconds: 15,
            cooldownMinutes: 30
        }));
        return;
    }

    // Rota 404 para qualquer outro caminho
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint não encontrado no Watchdog' }));
});

server.listen(WATCHDOG_PORT, '0.0.0.0', () => {
    console.log(`🛡️  [WATCHDOG] MetalFisa Watchdog rodando na porta ${WATCHDOG_PORT}`);
    console.log(`🛡️  [WATCHDOG] Monitorando porta principal ${MAIN_PORT} | Cooldown: 30 minutos`);
});
