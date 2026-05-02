const express = require('express');
const router = express.Router();
const mysqlService = require('../services/mysqlService');

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
