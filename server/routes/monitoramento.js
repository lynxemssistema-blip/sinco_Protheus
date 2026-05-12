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

module.exports = router;
