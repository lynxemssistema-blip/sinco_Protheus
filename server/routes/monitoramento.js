const express = require('express');
const router = express.Router();
const mysqlService = require('../services/mysqlService');
const db = require('../db');

router.get('/conexoes', async (req, res) => {
    try {
        const [mysqlResult] = await mysqlService.query("SHOW STATUS LIKE 'Threads_connected'");
        const mysqlConnections = mysqlResult && mysqlResult[0] ? parseInt(mysqlResult[0].Value, 10) : 0;

        const pgResult = await db.query("SELECT count(*) as count FROM pg_stat_activity");
        const pgConnections = pgResult && pgResult.rows && pgResult.rows[0] ? parseInt(pgResult.rows[0].count, 10) : 0;

        res.json({ success: true, data: { mysql: mysqlConnections, postgres: pgConnections } });
    } catch (error) {
        console.error('[API Monitoramento] Erro ao buscar conexões:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar conexões.' });
    }
});

// Rota protegida (necessita token e talvez perfil de admin, mas aqui mantemos simples e usamos o middleware global no index.js)
router.get('/historico', async (req, res) => {
    try {
        // Busca as últimas 24 horas ordenadas de forma ascendente para o gráfico
        const sql = `
            SELECT * FROM system_metrics 
            ORDER BY timestamp DESC 
            LIMIT 24
        `;
        const [rows] = await mysqlService.query(sql);
        
        // Inverte para ficar cronológico da esquerda para a direita no gráfico
        const chronologicalData = rows.reverse();
        
        res.json({ success: true, data: chronologicalData });
    } catch (error) {
        console.error('[API Monitoramento] Erro ao buscar histórico:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar métricas.' });
    }
});

router.get('/dba/snapshot', async (req, res) => {
    try {
        // 1. Hardware/Node info
        const os = require('os');
        const hardware = {
            uptime: os.uptime(),
            totalMem: os.totalmem(),
            freeMem: os.freemem(),
            cpuLoad: os.loadavg()[0],
            nodeMem: process.memoryUsage().rss
        };

        // 2. MySQL Metrics
        let mysqlMetrics = { active: 0, processList: [] };
        try {
            const [threads] = await mysqlService.query("SHOW STATUS LIKE 'Threads_connected'");
            mysqlMetrics.active = threads[0] ? parseInt(threads[0].Value, 10) : 0;
            const [plist] = await mysqlService.query("SHOW FULL PROCESSLIST");
            mysqlMetrics.processList = plist.filter(p => p.Command !== 'Sleep').map(p => ({
                id: p.Id, user: p.User, host: p.Host, db: p.db, command: p.Command, time: p.Time, state: p.State, info: p.Info
            }));
        } catch(e) { console.error('MySQL DBA error', e); }

        // 3. PostgreSQL Metrics
        let pgMetrics = { active: 0, total: 0, dbSize: '', slowQueries: [] };
        try {
            const countRes = await db.query("SELECT count(*) as total, sum(case when state = 'active' then 1 else 0 end) as active FROM pg_stat_activity");
            pgMetrics.total = parseInt(countRes.rows[0].total, 10) || 0;
            pgMetrics.active = parseInt(countRes.rows[0].active, 10) || 0;

            const sizeRes = await db.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
            pgMetrics.dbSize = sizeRes.rows[0]?.size || 'Unknown';

            const slowRes = await db.query(`
                SELECT pid, usename, client_addr, state, EXTRACT(EPOCH FROM (now() - query_start)) as duration, query 
                FROM pg_stat_activity 
                WHERE state = 'active' AND query NOT ILIKE '%pg_stat_activity%' 
                ORDER BY duration DESC LIMIT 10
            `);
            pgMetrics.slowQueries = slowRes.rows;
        } catch(e) { console.error('PG DBA error', e); }

        res.json({ success: true, data: { hardware, mysql: mysqlMetrics, postgres: pgMetrics } });
    } catch (error) {
        console.error('[API DBA] Erro no snapshot:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar snapshot DBA.' });
    }
});

module.exports = router;
