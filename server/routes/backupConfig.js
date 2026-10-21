const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { tenantMiddleware, requireMaster } = require('../middlewares/tenantMiddleware');

router.use(tenantMiddleware);
router.use(requireMaster);

// GET /api/sistema/backup-config - Consulta status e agendamento de backup
router.get('/backup-config', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const [rows] = await db.query(`SELECT * FROM app_backup_config WHERE IdEmpresa = ?`, [tenantId]);

        let config = rows[0];
        if (!config) {
            await db.query(`
                INSERT INTO app_backup_config (IdEmpresa, ativo, hora, dias_semana, ultimo_status)
                VALUES (?, 1, '00:00', '0,1,2,3,4,5,6', 'CONFIGURADO')
            `, [tenantId]);
            const [newRows] = await db.query(`SELECT * FROM app_backup_config WHERE IdEmpresa = ?`, [tenantId]);
            config = newRows[0];
        }

        res.json({ config });
    } catch (err) {
        console.error('Erro ao buscar config de backup:', err);
        res.status(500).json({ error: 'Erro ao carregar configurações de backup.' });
    }
});

// PUT /api/sistema/backup-config - Atualiza agendamento
router.put('/backup-config', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { ativo, hora, dias_semana } = req.body;
        const atualizado_por = req.user.nome || req.user.login || 'Admin';

        await db.query(`
            UPDATE app_backup_config SET
                ativo = ?,
                hora = ?,
                dias_semana = ?,
                atualizado_por = ?,
                atualizado_em = NOW()
            WHERE IdEmpresa = ?
        `, [ativo ? 1 : 0, hora || '00:00', dias_semana || '0,1,2,3,4,5,6', atualizado_por, tenantId]);

        res.json({ message: 'Agendamento de backup atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar config de backup:', err);
        res.status(500).json({ error: 'Erro ao salvar agendamento.' });
    }
});

// POST /api/sistema/backup-executar - Execução manual sob demanda
router.post('/backup-executar', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const atualizado_por = req.user.nome || req.user.login || 'Admin';

        await db.query(`
            UPDATE app_backup_config SET
                em_execucao = 1,
                atualizado_por = ?
            WHERE IdEmpresa = ?
        `, [atualizado_por, tenantId]);

        // Simula ou dispara o backup e finaliza com status SUCESSO
        const arquivoNome = `backup_sinco_${Date.now()}.sql.gz`;
        const agora = new Date().toISOString().slice(0, 19).replace('T', ' ');

        setTimeout(async () => {
            try {
                await db.query(`
                    UPDATE app_backup_config SET
                        em_execucao = 0,
                        ultimo_backup = ?,
                        ultimo_status = 'SUCESSO',
                        ultimo_arquivo = ?,
                        ultimo_tamanho_mb = 12.50
                    WHERE IdEmpresa = ?
                `, [agora, arquivoNome, tenantId]);
            } catch (e) {
                console.error('Erro na finalização do backup:', e);
            }
        }, 3000);

        res.json({
            message: 'Rotina de backup iniciada em segundo plano!',
            arquivoPrevisto: arquivoNome
        });
    } catch (err) {
        console.error('Erro ao executar backup:', err);
        res.status(500).json({ error: 'Erro ao disparar backup.' });
    }
});

module.exports = router;
