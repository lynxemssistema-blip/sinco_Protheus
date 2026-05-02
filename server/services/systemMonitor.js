const cron = require('node-cron');
const si = require('systeminformation');
const os = require('os');
const mysqlService = require('./mysqlService');

let totalMysqlQueries = 0;
let totalPgQueries = 0;

// Wrappers para contar queries, se possível, ou apenas logar
// Aqui criamos uma interface para que os arquivos db.js e mysqlService.js chamem ao executar queries
function incrementMysqlQuery() {
    totalMysqlQueries++;
}

function incrementPgQuery() {
    totalPgQueries++;
}

async function collectAndSaveMetrics(app) {
    try {
        console.log('[MONITORAMENTO] Coletando métricas do sistema...');
        
        // Obter número de usuários ativos pelo Socket.IO (se disponível)
        let activeUsers = 0;
        if (app) {
            const io = app.get('io');
            if (io && io.engine) {
                activeUsers = io.engine.clientsCount;
            }
        }

        // Dados de CPU e RAM
        const mem = await si.mem();
        const currentLoad = await si.currentLoad();
        
        const cpuUsagePercent = currentLoad.currentLoad.toFixed(2);
        const memoryUsageMB = (mem.used / 1024 / 1024).toFixed(2);
        const uptimeSeconds = os.uptime();

        // Dados de Rede
        const networkStats = await si.networkStats();
        let networkRxMB = 0;
        let networkTxMB = 0;
        if (networkStats && networkStats.length > 0) {
            // Soma o tráfego de todas as interfaces
            networkStats.forEach(net => {
                networkRxMB += (net.rx_bytes / 1024 / 1024);
                networkTxMB += (net.tx_bytes / 1024 / 1024);
            });
        }

        const queriesMy = totalMysqlQueries;
        const queriesPg = totalPgQueries;

        // Resetar contadores para a próxima hora
        totalMysqlQueries = 0;
        totalPgQueries = 0;

        // Salvar no banco
        const sql = `
            INSERT INTO system_metrics 
            (active_users, mysql_query_count, pg_query_count, cpu_usage_percent, memory_usage_mb, uptime_seconds, network_rx_mb, network_tx_mb)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            activeUsers, 
            queriesMy, 
            queriesPg, 
            cpuUsagePercent, 
            memoryUsageMB, 
            uptimeSeconds, 
            networkRxMB.toFixed(2), 
            networkTxMB.toFixed(2)
        ];

        await mysqlService.query(sql, values);
        console.log('[MONITORAMENTO] Métricas salvas com sucesso.');

    } catch (error) {
        console.error('[MONITORAMENTO] Erro ao coletar/salvar métricas:', error);
    }
}

function startMonitoring(app) {
    // Roda no minuto 0 de toda hora (0 * * * *)
    // Para testar, podemos rodar a cada 5 minutos (*/5 * * * *)
    cron.schedule('0 * * * *', () => {
        collectAndSaveMetrics(app);
    });
    console.log('✅ [MONITORAMENTO] Cron job de métricas do sistema iniciado (A cada 1 hora).');
}

module.exports = {
    startMonitoring,
    incrementMysqlQuery,
    incrementPgQuery
};
