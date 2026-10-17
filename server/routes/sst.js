const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(tenantMiddleware);

// ── 1. CATÁLOGO DE EPIS & SALDOS ────────────────────────────────

// GET /api/sst/epis - Lista catálogo de EPIs com saldos e alertas
router.get('/epis', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const [epis] = await db.query(`
            SELECT *,
                CASE 
                    WHEN ca_validade IS NOT NULL AND ca_validade < CURDATE() THEN 'vencido'
                    WHEN ca_validade IS NOT NULL AND ca_validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'vencendo_30_dias'
                    ELSE 'valido'
                END AS ca_status,
                CASE
                    WHEN saldo_atual <= estoque_minimo THEN 1
                    ELSE 0
                END AS estoque_critico
            FROM sst_epis_catalogo
            WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1)) AND ativo = 1
            ORDER BY descricao ASC
        `, [tenantId, tenantId]);

        res.json({ epis });
    } catch (err) {
        console.error('Erro ao listar EPIs:', err);
        res.status(500).json({ error: 'Erro ao carregar catálogo de EPIs.' });
    }
});

// POST /api/sst/epis - Cadastra ou atualiza EPI no catálogo
router.post('/epis', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const {
            id, produto_codigo, descricao, unidade, ca_numero, ca_validade,
            categoria_protecao, periodicidade_dias, instrucoes_uso,
            estoque_minimo, localizacao, custo_unitario
        } = req.body;

        if (!produto_codigo || !descricao || !ca_numero) {
            return res.status(400).json({ error: 'Código, descrição e CA são obrigatórios.' });
        }

        if (id) {
            // Atualizar
            await db.query(`
                UPDATE sst_epis_catalogo SET
                    produto_codigo = ?, descricao = ?, unidade = ?, ca_numero = ?, ca_validade = ?,
                    categoria_protecao = ?, periodicidade_dias = ?, instrucoes_uso = ?,
                    estoque_minimo = ?, localizacao = ?, custo_unitario = ?
                WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
            `, [
                produto_codigo, descricao, unidade || 'UN', ca_numero, ca_validade || null,
                categoria_protecao || 'membros_superiores', periodicidade_dias || 30, instrucoes_uso || null,
                estoque_minimo || 0, localizacao || null, custo_unitario || 0,
                id, tenantId, tenantId
            ]);
            return res.json({ id, message: 'EPI atualizado com sucesso!' });
        } else {
            // Inserir
            const [result] = await db.query(`
                INSERT INTO sst_epis_catalogo (
                    IdEmpresa, produto_codigo, descricao, unidade, ca_numero, ca_validade,
                    categoria_protecao, periodicidade_dias, instrucoes_uso, saldo_atual,
                    estoque_minimo, localizacao, custo_unitario, ativo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, 1)
            `, [
                tenantId, produto_codigo, descricao, unidade || 'UN', ca_numero, ca_validade || null,
                categoria_protecao || 'membros_superiores', periodicidade_dias || 30, instrucoes_uso || null,
                estoque_minimo || 0, localizacao || null, custo_unitario || 0
            ]);
            return res.json({ id: result.insertId, message: 'EPI cadastrado com sucesso!' });
        }
    } catch (err) {
        console.error('Erro ao salvar EPI:', err);
        res.status(500).json({ error: 'Erro ao cadastrar EPI.' });
    }
});

// ── 2. FICHAS DIGITAIS DE EPI (NR-06) ───────────────────────────

// GET /api/sst/fichas - Lista colaboradores com status de posse de EPIs
router.get('/fichas', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const [fichas] = await db.query(`
            SELECT u.idUsuario, u.NomeCompleto, u.email, u.Setor, u.Funcao,
                   f.id AS ficha_id, f.data_abertura, f.status AS ficha_status,
                   COUNT(CASE WHEN e.status_entrega = 'em_uso' THEN 1 END) AS total_epis_em_uso,
                   MIN(CASE WHEN e.status_entrega = 'em_uso' THEN e.previsao_troca END) AS proxima_troca_data
            FROM usuario u
            LEFT JOIN sst_fichas_epi f ON f.usuario_id = u.idUsuario AND (f.IdEmpresa = ? OR (f.IdEmpresa IS NULL AND ? = 1))
            LEFT JOIN sst_fichas_entregas e ON e.ficha_id = f.id AND e.status_entrega = 'em_uso'
            WHERE (u.IdEmpresa = ? OR (u.IdEmpresa IS NULL AND ? = 1))
              AND (u.D_E_L_E_T_E IS NULL OR u.D_E_L_E_T_E <> '*')
            GROUP BY u.idUsuario, f.id
            ORDER BY u.NomeCompleto ASC
        `, [tenantId, tenantId, tenantId, tenantId]);

        res.json({ fichas });
    } catch (err) {
        console.error('Erro ao buscar fichas:', err);
        res.status(500).json({ error: 'Erro ao listar fichas de colaboradores.' });
    }
});

// GET /api/sst/fichas/:usuario_id - Detalhes da ficha do colaborador
router.get('/fichas/:usuario_id', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { usuario_id } = req.params;

        // Dados do colaborador
        const [usrRows] = await db.query(`
            SELECT idUsuario, NomeCompleto, email, Setor, Funcao, whatsapp, telefone
            FROM usuario WHERE idUsuario = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [usuario_id, tenantId, tenantId]);

        if (usrRows.length === 0) {
            return res.status(404).json({ error: 'Colaborador não encontrado.' });
        }
        const colaborador = usrRows[0];

        // Ficha
        let [fichaRows] = await db.query(`
            SELECT * FROM sst_fichas_epi WHERE usuario_id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [usuario_id, tenantId, tenantId]);

        let ficha = fichaRows[0];
        if (!ficha) {
            // Criação automática da ficha se não existir
            const [newFicha] = await db.query(`
                INSERT INTO sst_fichas_epi (IdEmpresa, usuario_id, data_abertura, status)
                VALUES (?, ?, CURDATE(), 'ativo')
            `, [tenantId, usuario_id]);
            ficha = { id: newFicha.insertId, usuario_id, data_abertura: new Date().toISOString().slice(0, 10), status: 'ativo' };
        }

        // Histórico de entregas
        const [entregas] = await db.query(`
            SELECT fe.*, c.descricao AS epi_nome, c.produto_codigo, c.categoria_protecao
            FROM sst_fichas_entregas fe
            INNER JOIN sst_epis_catalogo c ON c.id = fe.epi_id
            WHERE fe.ficha_id = ?
            ORDER BY fe.data_entrega DESC, fe.id DESC
        `, [ficha.id]);

        res.json({ colaborador, ficha, entregas });
    } catch (err) {
        console.error('Erro ao buscar ficha do colaborador:', err);
        res.status(500).json({ error: 'Erro ao carregar histórico de EPIs.' });
    }
});

// ── 3. MOTOR KARDEX: ENTREGAS & DEVOLUÇÕES ATÔMICAS ─────────────

// POST /api/sst/entregas - Registra entrega com baixa atômica no estoque
router.post('/entregas', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const {
            ficha_id, epi_id, quantidade = 1, motivo = 'periodico',
            data_entrega = new Date().toISOString().slice(0, 10),
            lote_fabricante, validade_fabricante, observacoes
        } = req.body;
        const entregue_por = req.user.nome || req.user.NomeCompleto || req.user.login || 'Almoxarifado';

        // 1. Obter dados do EPI e saldo atual
        const [epiRows] = await db.query(`SELECT * FROM sst_epis_catalogo WHERE id = ? FOR UPDATE`, [epi_id]);
        if (epiRows.length === 0) {
            return res.status(404).json({ error: 'EPI não encontrado no catálogo.' });
        }
        const epi = epiRows[0];
        const saldoAnterior = parseFloat(epi.saldo_atual || 0);
        const qtdNum = parseFloat(quantidade);

        if (saldoAnterior < qtdNum) {
            return res.status(400).json({
                error: `Saldo insuficiente! Saldo atual do EPI "${epi.descricao}" é ${saldoAnterior} ${epi.unidade}.`
            });
        }

        const saldoNovo = saldoAnterior - qtdNum;

        // 2. Calcular data prevista de troca
        const diasPeriodicidade = epi.periodicidade_dias || 30;
        const dtEntregaObj = new Date(data_entrega);
        const previsaoTroca = new Date(dtEntregaObj.getTime() + diasPeriodicidade * 24 * 60 * 60 * 1000)
            .toISOString().slice(0, 10);

        // 3. Atualizar saldo do catálogo
        await db.query(`UPDATE sst_epis_catalogo SET saldo_atual = ? WHERE id = ?`, [saldoNovo, epi_id]);

        // 4. Inserir registro na ficha de entrega
        const [entregaResult] = await db.query(`
            INSERT INTO sst_fichas_entregas (
                IdEmpresa, ficha_id, epi_id, ca_numero, ca_validade, quantidade, unidade,
                motivo, data_entrega, previsao_troca, lote_fabricante, validade_fabricante,
                entregue_por, status_entrega, termo_aceite_digital, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'em_uso', 1, ?)
        `, [
            tenantId, ficha_id, epi_id, epi.ca_numero, epi.ca_validade, qtdNum, epi.unidade,
            motivo, data_entrega, previsaoTroca, lote_fabricante || null, validade_fabricante || null,
            entregue_por, observacoes || null
        ]);

        // 5. Inserir registro Kardex
        await db.query(`
            INSERT INTO sst_epis_movimentacoes (
                IdEmpresa, epi_id, tipo_movimentacao, quantidade, saldo_anterior, saldo_novo,
                custo_unitario, documento_referencia, usuario_responsavel, motivo_observacao
            ) VALUES (?, ?, 'saida_entrega', ?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId, epi_id, qtdNum, saldoAnterior, saldoNovo,
            epi.custo_unitario || 0, `ENTREGA-FICHA-${ficha_id}`, entregue_por,
            `Entrega de EPI ao colaborador (Ficha #${ficha_id})`
        ]);

        res.json({
            id: entregaResult.insertId,
            message: 'EPI entregue e baixado do estoque com sucesso!',
            saldoAtual: saldoNovo
        });
    } catch (err) {
        console.error('Erro na entrega de EPI:', err);
        res.status(500).json({ error: 'Erro ao registrar entrega de EPI.' });
    }
});

// POST /api/sst/entregas/:id/devolver - Devolução para reaproveitamento ou descarte
router.post('/entregas/:id/devolver', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { id } = req.params;
        const { motivo_devolucao, acao = 'reaproveitar' } = req.body; // 'reaproveitar' ou 'descartar'
        const usuario_responsavel = req.user.nome || req.user.login || 'Almoxarifado';

        const [entregaRows] = await db.query(`SELECT * FROM sst_fichas_entregas WHERE id = ?`, [id]);
        if (entregaRows.length === 0) {
            return res.status(404).json({ error: 'Entrega não encontrada.' });
        }
        const entrega = entregaRows[0];
        const statusFinal = acao === 'reaproveitar' ? 'devolvido' : 'descartado';

        // Atualizar ficha
        await db.query(`
            UPDATE sst_fichas_entregas SET
                status_entrega = ?, data_devolucao = CURDATE(), motivo_devolucao = ?
            WHERE id = ?
        `, [statusFinal, motivo_devolucao || 'Devolução registrada', id]);

        if (acao === 'reaproveitar') {
            // Estorno no Kardex
            const [epiRows] = await db.query(`SELECT saldo_atual, custo_unitario FROM sst_epis_catalogo WHERE id = ?`, [entrega.epi_id]);
            const saldoAnterior = parseFloat(epiRows[0]?.saldo_atual || 0);
            const qtdNum = parseFloat(entrega.quantidade || 1);
            const saldoNovo = saldoAnterior + qtdNum;

            await db.query(`UPDATE sst_epis_catalogo SET saldo_atual = ? WHERE id = ?`, [saldoNovo, entrega.epi_id]);

            await db.query(`
                INSERT INTO sst_epis_movimentacoes (
                    IdEmpresa, epi_id, tipo_movimentacao, quantidade, saldo_anterior, saldo_novo,
                    custo_unitario, documento_referencia, usuario_responsavel, motivo_observacao
                ) VALUES (?, ?, 'devolucao_reaproveitamento', ?, ?, ?, ?, ?, ?, ?)
            `, [
                tenantId, entrega.epi_id, qtdNum, saldoAnterior, saldoNovo,
                epiRows[0]?.custo_unitario || 0, `DEV-ENTREGA-${id}`, usuario_responsavel,
                `Devolução para reaproveitamento: ${motivo_devolucao || ''}`
            ]);
        }

        res.json({ message: `EPI ${statusFinal === 'devolvido' ? 'estornado ao estoque' : 'descartado'} com sucesso!` });
    } catch (err) {
        console.error('Erro na devolução:', err);
        res.status(500).json({ error: 'Erro ao processar devolução.' });
    }
});

// ── 4. MOVIMENTAÇÕES DE ESTOQUE KARDEX (COMPRA / INVENTÁRIO) ────

// GET /api/sst/movimentacoes - Histórico Kardex
router.get('/movimentacoes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { epi_id, limit = 50 } = req.query;

        let query = `
            SELECT m.*, c.descricao AS epi_nome, c.produto_codigo, c.unidade
            FROM sst_epis_movimentacoes m
            INNER JOIN sst_epis_catalogo c ON c.id = m.epi_id
            WHERE (m.IdEmpresa = ? OR (m.IdEmpresa IS NULL AND ? = 1))
        `;
        const params = [tenantId, tenantId];

        if (epi_id) {
            query += ` AND m.epi_id = ?`;
            params.push(epi_id);
        }
        query += ` ORDER BY m.created_at DESC LIMIT ?`;
        params.push(parseInt(limit));

        const [movimentacoes] = await db.query(query, params);
        res.json({ movimentacoes });
    } catch (err) {
        console.error('Erro ao listar movimentações Kardex:', err);
        res.status(500).json({ error: 'Erro ao carregar movimentações.' });
    }
});

// POST /api/sst/movimentacoes - Registra entrada por compra ou ajuste
router.post('/movimentacoes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { epi_id, tipo_movimentacao, quantidade, custo_unitario, documento_referencia, motivo_observacao } = req.body;
        const usuario_responsavel = req.user.nome || req.user.login || 'Almoxarifado';

        const [epiRows] = await db.query(`SELECT saldo_atual FROM sst_epis_catalogo WHERE id = ? FOR UPDATE`, [epi_id]);
        if (epiRows.length === 0) {
            return res.status(404).json({ error: 'EPI não encontrado.' });
        }

        const saldoAnterior = parseFloat(epiRows[0].saldo_atual || 0);
        const qtdNum = parseFloat(quantidade);

        let saldoNovo = saldoAnterior;
        if (tipo_movimentacao === 'entrada_compra') {
            saldoNovo = saldoAnterior + qtdNum;
        } else if (tipo_movimentacao === 'descarte') {
            saldoNovo = Math.max(0, saldoAnterior - qtdNum);
        } else if (tipo_movimentacao === 'ajuste_inventario') {
            saldoNovo = qtdNum; // no inventário, quantidade informada vira o novo saldo
        }

        await db.query(`UPDATE sst_epis_catalogo SET saldo_atual = ? WHERE id = ?`, [saldoNovo, epi_id]);

        await db.query(`
            INSERT INTO sst_epis_movimentacoes (
                IdEmpresa, epi_id, tipo_movimentacao, quantidade, saldo_anterior, saldo_novo,
                custo_unitario, documento_referencia, usuario_responsavel, motivo_observacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId, epi_id, tipo_movimentacao, qtdNum, saldoAnterior, saldoNovo,
            custo_unitario || 0, documento_referencia || null, usuario_responsavel,
            motivo_observacao || null
        ]);

        res.json({ message: 'Movimentação Kardex registrada!', saldoAtual: saldoNovo });
    } catch (err) {
        console.error('Erro ao registrar movimentação Kardex:', err);
        res.status(500).json({ error: 'Erro ao registrar movimentação.' });
    }
});

// ── 5. CONFIGURAÇÕES DE ALERTAS NR-06 ────────────────────────────

// GET /api/sst/configuracoes
router.get('/configuracoes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const [rows] = await db.query(`SELECT * FROM sst_configuracoes_alertas WHERE IdEmpresa = ?`, [tenantId]);
        res.json({ configuracao: rows[0] || null });
    } catch (err) {
        console.error('Erro nas configs SST:', err);
        res.status(500).json({ error: 'Erro ao carregar configurações.' });
    }
});

// PUT /api/sst/configuracoes
router.put('/configuracoes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const {
            notificar_whatsapp, notificar_email, dias_antecedencia,
            destinatario_colaborador, destinatario_tst, email_tst, whatsapp_tst
        } = req.body;

        await db.query(`
            INSERT INTO sst_configuracoes_alertas (
                IdEmpresa, notificar_whatsapp, notificar_email, dias_antecedencia,
                destinatario_colaborador, destinatario_tst, email_tst, whatsapp_tst
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                notificar_whatsapp = VALUES(notificar_whatsapp),
                notificar_email = VALUES(notificar_email),
                dias_antecedencia = VALUES(dias_antecedencia),
                destinatario_colaborador = VALUES(destinatario_colaborador),
                destinatario_tst = VALUES(destinatario_tst),
                email_tst = VALUES(email_tst),
                whatsapp_tst = VALUES(whatsapp_tst)
        `, [
            tenantId, notificar_whatsapp ? 1 : 0, notificar_email ? 1 : 0, dias_antecedencia || 7,
            destinatario_colaborador ? 1 : 0, destinatario_tst ? 1 : 0, email_tst || null, whatsapp_tst || null
        ]);

        res.json({ message: 'Configurações de alerta salvas com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar configs SST:', err);
        res.status(500).json({ error: 'Erro ao atualizar configurações.' });
    }
});

module.exports = router;
