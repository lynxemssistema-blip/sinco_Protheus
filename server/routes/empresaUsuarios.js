/**
 * Rotas de Gestão de Usuários da Empresa & Informações do Plano
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../services/mysqlService');
const { authenticateToken } = require('./auth');
const { tenantMiddleware, requireMaster } = require('../middlewares/tenantMiddleware');
const { PLANOS } = require('../config/planos');

// Aplica autenticação e tenant middleware em todas as rotas
router.use(authenticateToken);
router.use(tenantMiddleware);

/**
 * GET /api/empresa/meu-plano
 * Retorna dados detalhados do plano da empresa, limite de usuários e uso atual
 */
router.get('/meu-plano', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;

        // Contar usuários ativos na empresa
        const [userCount] = await db.query(
            'SELECT COUNT(*) as total_usuarios FROM usuario WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1)) AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E <> "*")',
            [tenantId, tenantId]
        );

        const totalAtivos = userCount[0].total_usuarios || 0;
        const tenant = req.tenant || {};
        const limite = tenant.limiteUsuarios || 10;
        const planoKey = tenant.plano || 'pro';
        const planoInfo = PLANOS[planoKey] || PLANOS.pro;

        // Determina a data efetiva de vigência (data_vencimento tem prioridade, senão trial_expira_em)
        const dataEfetiva = tenant.dataVencimento || tenant.trialExpiraEm;
        let diasRestantes = null;
        let diasRestantesTrial = null;

        if (dataEfetiva) {
            const diffMs = new Date(dataEfetiva) - new Date();
            diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            if (tenant.statusPlano === 'trial') {
                diasRestantesTrial = diasRestantes;
            }
        }

        res.json({
            empresa: {
                id: tenantId,
                nome: tenant.nomeFantasia,
                razaoSocial: tenant.razaoSocial,
                plano: planoKey,
                planoNome: planoInfo.nome,
                planoDescricao: planoInfo.descricao,
                status: tenant.statusPlano,
                dataVencimento: tenant.dataVencimento,
                trialExpiraEm: tenant.trialExpiraEm,
                diasRestantes,
                diasRestantesTrial,
                trialExpirado: tenant.trialExpirado || false
            },
            capacidade: {
                usuariosAtivos: totalAtivos,
                limiteUsuarios: limite,
                usuariosDisponiveis: Math.max(0, limite - totalAtivos),
                atingiuLimite: totalAtivos >= limite
            },
            modulosLiberados: planoInfo.modulos,
            todosPlanos: PLANOS
        });
    } catch (err) {
        console.error('Erro ao buscar plano da empresa:', err);
        res.status(500).json({ error: 'Erro ao carregar detalhes do plano' });
    }
});

/**
 * GET /api/empresa/usuarios
 * Lista todos os colaboradores da empresa
 */
router.get('/usuarios', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;

        const [usuarios] = await db.query(`
            SELECT 
                idUsuario, NomeCompleto, Login, email, telefone, 
                TipoUsuario, is_master, status, aprovado, DataCadastro
            FROM usuario 
            WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
              AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E <> '*')
            ORDER BY is_master DESC, NomeCompleto ASC
        `, [tenantId, tenantId]);

        res.json({ usuarios });
    } catch (err) {
        console.error('Erro ao listar usuários da empresa:', err);
        res.status(500).json({ error: 'Erro ao listar colaboradores' });
    }
});

/**
 * POST /api/empresa/usuarios
 * Adiciona um novo colaborador diretamente à empresa (Requer Master)
 */
router.post('/usuarios', requireMaster, async (req, res) => {
    const { nome, email, login, senha, telefone, tipo_usuario } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const tenantId = req.tenantId || 1;
    const cleanEmail = email.toLowerCase().trim();
    const cleanLogin = (login || cleanEmail).trim();

    try {
        // 1. Validar limite do plano
        const [userCount] = await db.query(
            'SELECT COUNT(*) as total FROM usuario WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1)) AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E <> "*")',
            [tenantId, tenantId]
        );

        const totalAtivos = userCount[0].total || 0;
        const limite = req.tenant?.limiteUsuarios || 10;

        if (totalAtivos >= limite && !req.isSuperAdmin) {
            return res.status(403).json({
                error: 'Limite de usuários atingido',
                message: `Seu plano atual permite até ${limite} colaboradores ativos. Faça upgrade para adicionar mais usuários.`
            });
        }

        // 2. Checar duplicidade de e-mail ou login
        const [exist] = await db.query(
            'SELECT idUsuario FROM usuario WHERE (email = ? OR Login = ?) AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E <> "*")',
            [cleanEmail, cleanLogin]
        );

        if (exist.length > 0) {
            return res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail ou login.' });
        }

        // 3. Inserir o novo usuário
        const hashedPwd = await bcrypt.hash(senha, 10);
        const role = tipo_usuario || 'operador';

        const [insertResult] = await db.execute(`
            INSERT INTO usuario (
                NomeCompleto, Login, Senha, email, telefone,
                TipoUsuario, is_master, IdEmpresa, aprovado, status, CriadoPor
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, '1', ?)
        `, [
            nome,
            cleanLogin,
            hashedPwd,
            cleanEmail,
            telefone || null,
            role,
            tenantId,
            req.user.nome || req.user.login
        ]);

        res.status(201).json({
            message: 'Colaborador adicionado com sucesso!',
            usuarioId: insertResult.insertId
        });
    } catch (err) {
        console.error('Erro ao adicionar colaborador:', err);
        res.status(500).json({ error: 'Erro ao cadastrar usuário: ' + err.message });
    }
});

/**
 * PATCH /api/empresa/usuarios/:id/status
 * Ativa ou inativa um colaborador
 */
router.patch('/usuarios/:id/status', requireMaster, async (req, res) => {
    const usuarioId = req.params.id;
    const { status } = req.body; // '1' ou '0'
    const tenantId = req.tenantId || 1;

    try {
        // Impede alterar status de si mesmo ou do master se for outro usuário
        if (parseInt(usuarioId) === req.user.id) {
            return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário.' });
        }

        await db.execute(
            'UPDATE usuario SET status = ? WHERE idUsuario = ? AND (IdEmpresa = ? OR ? = 1)',
            [status === '1' || status === 1 ? '1' : '0', usuarioId, tenantId, tenantId]
        );

        res.json({ message: 'Status do colaborador atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao alterar status:', err);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

/**
 * DELETE /api/empresa/usuarios/:id
 * Remove colaborador (Soft Delete)
 */
router.delete('/usuarios/:id', requireMaster, async (req, res) => {
    const usuarioId = req.params.id;
    const tenantId = req.tenantId || 1;

    try {
        if (parseInt(usuarioId) === req.user.id) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário.' });
        }

        // Impede excluir o Master fundador da empresa
        const [targetUser] = await db.query('SELECT is_master FROM usuario WHERE idUsuario = ?', [usuarioId]);
        if (targetUser.length > 0 && targetUser[0].is_master === 1 && !req.isSuperAdmin) {
            return res.status(403).json({ error: 'O Administrador Master da empresa não pode ser excluído.' });
        }

        await db.execute(
            'UPDATE usuario SET D_E_L_E_T_E = "*", status = "0" WHERE idUsuario = ? AND (IdEmpresa = ? OR ? = 1)',
            [usuarioId, tenantId, tenantId]
        );

        res.json({ message: 'Colaborador removido da empresa com sucesso.' });
    } catch (err) {
        console.error('Erro ao remover usuário:', err);
        res.status(500).json({ error: 'Erro ao remover colaborador' });
    }
});

/**
 * PATCH /api/empresa/usuarios/:id/aprovar
 * Aprova ou revoga o acesso de um colaborador (Requer Master)
 */
router.patch('/usuarios/:id/aprovar', requireMaster, async (req, res) => {
    const usuarioId = req.params.id;
    const { aprovado } = req.body; // 1 ou 0
    const tenantId = req.tenantId || 1;

    try {
        const valorAprovado = (aprovado === 1 || aprovado === true || aprovado === '1') ? 1 : 0;
        await db.execute(
            'UPDATE usuario SET aprovado = ?, status = ? WHERE idUsuario = ? AND (IdEmpresa = ? OR ? = 1)',
            [valorAprovado, valorAprovado === 1 ? '1' : '0', usuarioId, tenantId, tenantId]
        );

        res.json({
            message: valorAprovado === 1
                ? 'Colaborador aprovado com sucesso! O acesso ao sistema está liberado.'
                : 'Aprovação do colaborador revogada com sucesso.'
        });
    } catch (err) {
        console.error('Erro ao aprovar colaborador:', err);
        res.status(500).json({ error: 'Erro ao alterar aprovação do colaborador' });
    }
});

/**
 * POST /api/empresa/gerar-codigo-convite
 * Gera código de segurança numérico de 6 dígitos que expira em 30 minutos (Requer Master)
 */
router.post('/gerar-codigo-convite', requireMaster, async (req, res) => {
    const { email, telefone, tipo_usuario } = req.body;
    const tenantId = req.tenantId || 1;

    try {
        // 1. Checar limite do plano
        const [userCount] = await db.query(
            'SELECT COUNT(*) as total FROM usuario WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1)) AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E <> "*")',
            [tenantId, tenantId]
        );
        const totalAtivos = userCount[0].total || 0;
        const limite = req.tenant?.limiteUsuarios || 10;

        if (totalAtivos >= limite && !req.isSuperAdmin) {
            return res.status(403).json({
                error: 'Limite atingido',
                message: `Sua empresa atingiu o limite de ${limite} colaboradores. Faça upgrade para gerar mais convites.`
            });
        }

        // 2. Gerar código único de 6 dígitos
        let codigo = '';
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            codigo = Math.floor(100000 + Math.random() * 900000).toString();
            const [existing] = await db.query(
                'SELECT id FROM empresa_convites WHERE token = ? AND status = "pendente" AND expira_em > NOW()',
                [codigo]
            );
            if (existing.length === 0) {
                isUnique = true;
            }
            attempts++;
        }

        // 3. Validade de exatamente 30 minutos (calculada diretamente no banco de dados para eliminar desvios de fuso horário)
        const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

        // 4. Salvar no banco
        await db.execute(`
            INSERT INTO empresa_convites (
                IdEmpresa, email, tipo_usuario, token, status, expira_em
            ) VALUES (?, ?, ?, ?, 'pendente', DATE_ADD(NOW(), INTERVAL 30 MINUTE))
        `, [
            tenantId,
            email || null,
            tipo_usuario || 'operador',
            codigo
        ]);

        // 5. Montar texto e link para WhatsApp
        const nomeEmpresa = req.tenant?.nomeFantasia || req.tenant?.razaoSocial || 'Nossa Empresa';
        const horaExpiracao = expiraEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const appUrl = req.headers.origin || process.env.APP_URL || 'https://lynxems.com.br';

        const whatsappText = `🔐 *SINCO Industrial Suite - Código de Acesso*\n\n` +
            `Olá! Você foi convidado para acessar a empresa *${nomeEmpresa}* no SINCO.\n\n` +
            `🔑 *Código de Segurança:* *${codigo}*\n` +
            `⏳ *Atenção:* Este código expira em *30 minutos* (às ${horaExpiracao}).\n\n` +
            `👉 Para entrar, acesse:\n${appUrl}\n\n` +
            `Clique em *Criar Conta*, selecione *Sou Colaborador* e informe seu código de segurança.`;

        let cleanPhone = (telefone || '').replace(/\D/g, '');
        if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }

        const whatsappUrl = cleanPhone 
            ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappText)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

        res.status(201).json({
            message: 'Código de segurança gerado com sucesso! Válido por 30 minutos.',
            codigo,
            expira_em: expiraEmStr,
            minutos_validade: 30,
            hora_expiracao: horaExpiracao,
            whatsapp_text: whatsappText,
            whatsapp_url: whatsappUrl,
            empresa_nome: nomeEmpresa
        });
    } catch (err) {
        console.error('Erro ao gerar código de convite:', err);
        res.status(500).json({ error: 'Erro ao gerar código: ' + err.message });
    }
});

/**
 * GET /api/empresa/codigos-convite
 * Lista códigos de segurança pendentes e ativos da empresa (Requer Master)
 */
router.get('/codigos-convite', requireMaster, async (req, res) => {
    const tenantId = req.tenantId || 1;

    try {
        const [codigos] = await db.query(`
            SELECT 
                id, token as codigo, email, tipo_usuario, status, criado_em, expira_em,
                TIMESTAMPDIFF(MINUTE, NOW(), expira_em) as minutos_restantes
            FROM empresa_convites
            WHERE (IdEmpresa = ? OR ? = 1)
              AND status = 'pendente'
              AND expira_em > NOW()
            ORDER BY criado_em DESC
        `, [tenantId, tenantId]);

        res.json({ codigos });
    } catch (err) {
        console.error('Erro ao buscar códigos:', err);
        res.status(500).json({ error: 'Erro ao carregar códigos de convite' });
    }
});

/**
 * DELETE /api/empresa/codigos-convite/:id
 * Revoga um código de segurança (Requer Master)
 */
router.delete('/codigos-convite/:id', requireMaster, async (req, res) => {
    const conviteId = req.params.id;
    const tenantId = req.tenantId || 1;

    try {
        await db.execute(
            'UPDATE empresa_convites SET status = "expirado" WHERE id = ? AND (IdEmpresa = ? OR ? = 1)',
            [conviteId, tenantId, tenantId]
        );
        res.json({ message: 'Código de convite revogado com sucesso.' });
    } catch (err) {
        console.error('Erro ao revogar código:', err);
        res.status(500).json({ error: 'Erro ao revogar código' });
    }
});

module.exports = router;
