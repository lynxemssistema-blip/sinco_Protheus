/**
 * Rotas Exclusivas do Superadmin da Plataforma (edsonmanoel2012@gmail.com)
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../services/mysqlService');
const { authenticateToken } = require('./auth');
const { tenantMiddleware, requireSuperAdmin } = require('../middlewares/tenantMiddleware');
const { PLANOS } = require('../config/planos');

const SECRET_KEY = process.env.JWT_SECRET;

// Aplica autenticação, tenant middleware e trava de Superadmin em todas as rotas
router.use(authenticateToken);
router.use(tenantMiddleware);
router.use(requireSuperAdmin);

/**
 * GET /api/superadmin/metricas
 * Métricas gerais de toda a plataforma SaaS
 */
router.get('/metricas', async (req, res) => {
    try {
        const [totalEmpresas] = await db.query('SELECT COUNT(*) as total FROM empresa');
        const [totalUsuarios] = await db.query('SELECT COUNT(*) as total FROM usuario WHERE (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E <> "*")');
        const [ativasCount] = await db.query('SELECT COUNT(*) as total FROM empresa WHERE COALESCE(ativa, 1) = 1');
        const [desativadasCount] = await db.query('SELECT COUNT(*) as total FROM empresa WHERE COALESCE(ativa, 1) = 0');
        const [vencendoEmBreve] = await db.query('SELECT COUNT(*) as total FROM empresa WHERE data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)');
        const [vencidas] = await db.query('SELECT COUNT(*) as total FROM empresa WHERE data_vencimento < CURDATE()');
        
        const [planosCount] = await db.query(`
            SELECT plano, COUNT(*) as count 
            FROM empresa 
            GROUP BY plano
        `);

        const [statusCount] = await db.query(`
            SELECT status_plano, COUNT(*) as count 
            FROM empresa 
            GROUP BY status_plano
        `);

        res.json({
            metricas: {
                totalEmpresas: totalEmpresas[0]?.total || 0,
                totalUsuarios: totalUsuarios[0]?.total || 0,
                empresasAtivas: ativasCount[0]?.total || 0,
                empresasDesativadas: desativadasCount[0]?.total || 0,
                vencendoEmBreve: vencendoEmBreve[0]?.total || 0,
                vencidas: vencidas[0]?.total || 0,
                distribuicaoPlanos: planosCount,
                distribuicaoStatus: statusCount
            },
            planosConfig: PLANOS
        });
    } catch (err) {
        console.error('Erro ao buscar métricas de superadmin:', err);
        res.status(500).json({ error: 'Erro ao gerar métricas do sistema' });
    }
});

/**
 * GET /api/superadmin/empresas
 * Lista todas as empresas cadastradas no ecossistema com dados de assinatura e vencimento
 */
router.get('/empresas', async (req, res) => {
    try {
        const [empresas] = await db.query(`
            SELECT 
                e.IdEmpresa, e.RazaoSocial, e.NomeFantasia, e.Segmento, e.Cnpj,
                e.Email, e.Telefone, e.plano, e.status_plano, 
                COALESCE(e.ativa, 1) as ativa,
                e.data_vencimento, e.valor_mensalidade, e.motivo_bloqueio,
                e.trial_expira_em, e.limite_usuarios, e.CriadoEm,
                (SELECT COUNT(*) FROM usuario u WHERE u.IdEmpresa = e.IdEmpresa AND (u.D_E_L_E_T_E IS NULL OR u.D_E_L_E_T_E <> '*')) as total_usuarios,
                (SELECT NomeCompleto FROM usuario u WHERE u.IdEmpresa = e.IdEmpresa AND u.is_master = 1 LIMIT 1) as responsavel_nome,
                (SELECT email FROM usuario u WHERE u.IdEmpresa = e.IdEmpresa AND u.is_master = 1 LIMIT 1) as responsavel_email
            FROM empresa e
            ORDER BY e.IdEmpresa ASC
        `);

        res.json({ empresas });
    } catch (err) {
        console.error('Erro ao listar empresas no superadmin:', err);
        res.status(500).json({ error: 'Erro ao carregar lista de empresas' });
    }
});

/**
 * PATCH /api/superadmin/empresas/:id
 * Altera plano, limites, ativação, data de vencimento ou status da empresa
 */
router.patch('/empresas/:id', async (req, res) => {
    const empresaId = req.params.id;
    const { 
        plano, 
        status_plano, 
        ativa, 
        data_vencimento, 
        valor_mensalidade, 
        motivo_bloqueio, 
        limite_usuarios, 
        estender_dias_trial 
    } = req.body;

    try {
        const updates = [];
        const params = [];

        if (plano && PLANOS[plano]) {
            updates.push('plano = ?');
            params.push(plano);
            
            // Atualiza o limite de acordo com o plano se não for enviado manualmente
            if (!limite_usuarios) {
                updates.push('limite_usuarios = ?');
                params.push(PLANOS[plano].limite_usuarios);
            }
        }

        if (status_plano) {
            updates.push('status_plano = ?');
            params.push(status_plano);
        }

        if (ativa !== undefined && ativa !== null) {
            const isAtiva = ativa === true || ativa === 1 || ativa === '1';
            updates.push('ativa = ?');
            params.push(isAtiva ? 1 : 0);
            if (!status_plano) {
                updates.push('status_plano = ?');
                params.push(isAtiva ? 'ativo' : 'bloqueado');
            }
        }

        if (data_vencimento !== undefined) {
            updates.push('data_vencimento = ?');
            params.push(data_vencimento ? data_vencimento.split('T')[0] : null);
        }

        if (valor_mensalidade !== undefined) {
            updates.push('valor_mensalidade = ?');
            params.push(parseFloat(valor_mensalidade) || 0.00);
        }

        if (motivo_bloqueio !== undefined) {
            updates.push('motivo_bloqueio = ?');
            params.push(motivo_bloqueio ? String(motivo_bloqueio).slice(0, 255) : null);
        }

        if (limite_usuarios) {
            updates.push('limite_usuarios = ?');
            params.push(parseInt(limite_usuarios));
        }

        if (estender_dias_trial && !isNaN(parseInt(estender_dias_trial))) {
            const dias = parseInt(estender_dias_trial);
            updates.push('trial_expira_em = DATE_ADD(IFNULL(trial_expira_em, NOW()), INTERVAL ? DAY)');
            params.push(dias);
            updates.push("status_plano = 'trial'");
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
        }

        params.push(empresaId);
        await db.execute(`UPDATE empresa SET ${updates.join(', ')} WHERE IdEmpresa = ?`, params);

        res.json({ message: 'Dados da empresa, assinatura e plano atualizados com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar empresa:', err);
        res.status(500).json({ error: 'Erro ao salvar alterações da empresa' });
    }
});

/**
 * POST /api/superadmin/empresas/:id/toggle-status
 * Ativa ou Desativa uma empresa rapidamente
 */
router.post('/empresas/:id/toggle-status', async (req, res) => {
    const empresaId = req.params.id;
    try {
        const [rows] = await db.query('SELECT IdEmpresa, COALESCE(ativa, 1) as ativa, status_plano FROM empresa WHERE IdEmpresa = ?', [empresaId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Empresa não encontrada.' });

        const atualAtiva = rows[0].ativa === 1;
        const novoStatusAtiva = atualAtiva ? 0 : 1;
        const novoStatusPlano = novoStatusAtiva ? 'ativo' : 'bloqueado';

        await db.execute(
            'UPDATE empresa SET ativa = ?, status_plano = ? WHERE IdEmpresa = ?',
            [novoStatusAtiva, novoStatusPlano, empresaId]
        );

        res.json({ 
            ok: true, 
            ativa: novoStatusAtiva === 1,
            status_plano: novoStatusPlano,
            message: novoStatusAtiva === 1 ? 'Empresa ativada com sucesso!' : 'Empresa desativada com sucesso!' 
        });
    } catch (err) {
        console.error('Erro ao alternar status da empresa:', err);
        res.status(500).json({ error: 'Erro ao alternar status da empresa' });
    }
});

/**
 * POST /api/superadmin/empresas/:id/revalidar
 * Prorroga a data de vencimento / mensalidade por +30 dias (ou período informado) e reativa a empresa
 */
router.post('/empresas/:id/revalidar', async (req, res) => {
    const empresaId = req.params.id;
    const { dias = 30, novaData } = req.body;

    try {
        let sql = '';
        let params = [];

        if (novaData) {
            sql = 'UPDATE empresa SET data_vencimento = ?, ativa = 1, status_plano = "ativo" WHERE IdEmpresa = ?';
            params = [novaData.split('T')[0], empresaId];
        } else {
            sql = 'UPDATE empresa SET data_vencimento = DATE_ADD(GREATEST(IFNULL(data_vencimento, CURDATE()), CURDATE()), INTERVAL ? DAY), ativa = 1, status_plano = "ativo" WHERE IdEmpresa = ?';
            params = [parseInt(dias) || 30, empresaId];
        }

        await db.execute(sql, params);

        const [rows] = await db.query('SELECT data_vencimento, ativa, status_plano FROM empresa WHERE IdEmpresa = ?', [empresaId]);
        res.json({ 
            ok: true, 
            message: `Assinatura revalidada com sucesso! Vencimento: ${rows[0]?.data_vencimento}`,
            data_vencimento: rows[0]?.data_vencimento
        });
    } catch (err) {
        console.error('Erro ao revalidar assinatura da empresa:', err);
        res.status(500).json({ error: 'Erro ao revalidar assinatura' });
    }
});

/**
 * GET /api/superadmin/impersonate/:id
 * Gera um token de impersonation para o Superadmin acessar como qualquer empresa
 */
router.get('/impersonate/:id', async (req, res) => {
    const targetEmpresaId = parseInt(req.params.id);

    try {
        const [empRows] = await db.query(
            'SELECT IdEmpresa, RazaoSocial, NomeFantasia, plano, status_plano FROM empresa WHERE IdEmpresa = ?',
            [targetEmpresaId]
        );

        if (empRows.length === 0 && targetEmpresaId !== 1) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }

        const emp = empRows[0] || { IdEmpresa: 1, NomeFantasia: 'Empresa Principal' };

        // Emite token contendo o tenantId selecionado e a flag de impersonating
        const token = jwt.sign(
            {
                id: req.user.id,
                login: req.user.login,
                email: req.user.email,
                nome: req.user.nome + ' (Suporte)',
                tipo: 'superadmin',
                IdEmpresa: targetEmpresaId,
                is_master: true,
                is_superadmin: true,
                impersonating: true
            },
            SECRET_KEY,
            { expiresIn: '4h' }
        );

        res.json({
            message: `Acessando empresa "${emp.NomeFantasia}" em modo de auditoria/suporte.`,
            token,
            empresaAtiva: {
                id: emp.IdEmpresa,
                nome: emp.NomeFantasia,
                plano: emp.plano
            }
        });
    } catch (err) {
        console.error('Erro ao gerar impersonation token:', err);
        res.status(500).json({ error: 'Falha ao acessar empresa como superadmin' });
    }
});

module.exports = router;
