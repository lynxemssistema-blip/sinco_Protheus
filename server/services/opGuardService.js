/**
 * Guarda de alterações em OPs (fracionamento, programações PCP, lotes e liberação) + histórico.
 *
 * Regras (definidas pelo PCP em out/2026):
 * - Item com Lote LPF (aberto ou liberado), Lote PCP, Liberação PCP (Mescla), plano de corte ou
 *   apontamento iniciado NÃO pode ter a OP alterada: fracionar, reajustar frações, desfazer
 *   fracionamento, excluir OP, incluir/remover programação ou mudar quantidade. Só a Data PCP é livre.
 * - Número de OP de fração = OP original do pedido/item (11 dígitos) + letra da fração (AA, AB...).
 * - Toda ação (inclusive tentativa bloqueada) vai para app_op_historico com o usuário autenticado.
 */
const mysqlPool = require('./mysqlService');

const ACOES = {
    OP_CRIADA: 'OP_CRIADA',
    OP_EXCLUIDA: 'OP_EXCLUIDA',
    FRACIONAMENTO_CRIADO: 'FRACIONAMENTO_CRIADO',
    FRACIONAMENTO_REAJUSTADO: 'FRACIONAMENTO_REAJUSTADO',
    FRACIONAMENTO_DESFEITO: 'FRACIONAMENTO_DESFEITO',
    PROGRAMACAO_CRIADA: 'PROGRAMACAO_CRIADA',
    PROGRAMACAO_EDITADA: 'PROGRAMACAO_EDITADA',
    PROGRAMACAO_REMOVIDA: 'PROGRAMACAO_REMOVIDA',
    PLANEJAMENTO_PCP_LOTE: 'PLANEJAMENTO_PCP_LOTE',
    LOTE_ITEM_INCLUIDO: 'LOTE_ITEM_INCLUIDO',
    LOTE_ITEM_REMOVIDO: 'LOTE_ITEM_REMOVIDO',
    LOTE_DESMANCHADO: 'LOTE_DESMANCHADO',
    LIBERACAO_REGISTRADA: 'LIBERACAO_REGISTRADA',
    LOTE_LIBERADO: 'LOTE_LIBERADO',
    PLANO_CORTE_GERADO: 'PLANO_CORTE_GERADO',
    MESCLA_LIBERADA: 'MESCLA_LIBERADA',
    ACAO_BLOQUEADA: 'ACAO_BLOQUEADA'
};

(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_op_historico (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                pedido        VARCHAR(20)  NULL,
                item          VARCHAR(10)  NULL,
                op_numero     VARCHAR(30)  NULL,
                fracao        VARCHAR(10)  NULL,
                lote_codigo   VARCHAR(40)  NULL,
                acao          VARCHAR(40)  NOT NULL,
                descricao     VARCHAR(600) NULL,
                dados_antes   LONGTEXT     NULL,
                dados_depois  LONGTEXT     NULL,
                usuario_id    INT          NULL,
                usuario_nome  VARCHAR(120) NULL,
                usuario_login VARCHAR(80)  NULL,
                origem        VARCHAR(80)  NULL,
                IdEmpresa     INT          NULL,
                created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_hist_pedido_item (pedido, item),
                INDEX idx_hist_lote (lote_codigo),
                INDEX idx_hist_acao (acao),
                INDEX idx_hist_data (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    } catch (err) {
        console.error('❌ [OP HISTÓRICO] Erro ao criar app_op_historico:', err.message);
    }

    // Apontamento por fração (Etapa 2): identifica a fração PCP (AA, AB...) de cada apontamento
    try {
        await mysqlPool.query(`ALTER TABLE app_production_appointments ADD COLUMN fracao_pcp VARCHAR(10) DEFAULT NULL`);
    } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') console.error('❌ [OP HISTÓRICO] Erro ao adicionar fracao_pcp:', err.message);
    }
    try {
        await mysqlPool.query(`ALTER TABLE app_production_appointments ADD INDEX idx_apont_fracao (op_numero, op_item, op_sequencia, operacao_codigo, fracao_pcp)`);
    } catch (err) {
        if (err.code !== 'ER_DUP_KEYNAME') console.error('❌ [OP HISTÓRICO] Erro ao criar índice de fracao_pcp:', err.message);
    }
})();

// ── Normalização ────────────────────────────────────────────────────────────

const normPedido = (pedido) => String(pedido ?? '').trim().padStart(6, '0');

// '1' -> '01', '1a' -> '01A'; mantém o sufixo das frações criadas junto com a OP
const normItem = (item) => {
    const s = String(item ?? '').trim();
    if (/^[0-9]+$/.test(s)) return s.padStart(2, '0');
    const m = s.match(/^([0-9]+)([A-Z]+)$/i);
    if (m) return m[1].padStart(2, '0') + m[2].toUpperCase();
    return s.toUpperCase();
};

const pedidoVariants = (pedido) => {
    const raw = String(pedido ?? '').trim();
    const pad = normPedido(raw);
    const num = String(parseInt(raw, 10) || raw);
    return [...new Set([raw, pad, num])].filter(Boolean);
};

const itemVariants = (item) => {
    const raw = String(item ?? '').trim();
    const semZero = /^[0-9]+$/.test(raw) ? String(parseInt(raw, 10)) : raw;
    return [...new Set([raw, normItem(raw), semZero])].filter(Boolean);
};

// OP de 11 dígitos (6 OP + 2 item + 3 sequência) a partir do que estiver gravado
const toOpBase11 = (op, item) => {
    const s = String(op ?? '').trim();
    if (!s || s === '-') return null;
    if (s.length >= 11) return s.substring(0, 11);
    if (s.length === 8) return `${s}001`;
    if (s.length === 6) return `${s}${normItem(item)}001`;
    return s;
};

const getFractionLetter = (index) =>
    `${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`;

// Tabela opcional ausente no ambiente não deve travar a operação
const queryOptional = async (conn, sql, params) => {
    try {
        const [rows] = await conn.query(sql, params);
        return rows;
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return [];
        throw err;
    }
};

/**
 * OP original (pai) do pedido/item. Ordem: OP gerada no sistema (erp_ordens_producao) e depois sc2010.
 * Sem OP: base derivada do pedido (pedido 6 + item 2 + 001), mesmo padrão da tela.
 */
async function resolveItemOp(conn, pedido, item) {
    const peds = pedidoVariants(pedido);
    const itens = itemVariants(item);

    const erpOps = await queryOptional(conn,
        `SELECT numero_op FROM erp_ordens_producao
         WHERE TRIM(pedido_venda) IN (?) AND TRIM(item_pedido) IN (?) AND (is_sub_op = 0 OR is_sub_op IS NULL)
         LIMIT 1`,
        [peds, itens]
    );
    if (erpOps.length > 0 && erpOps[0].numero_op) {
        return { opBase: toOpBase11(erpOps[0].numero_op, item), origem: 'sistema' };
    }

    const sc2Ops = await queryOptional(conn,
        `SELECT c2_num, c2_item, c2_sequen FROM sc2010
         WHERE TRIM(c2_pedido) IN (?) AND TRIM(c2_itempv) IN (?) AND TRIM(c2_sequen) = '001'
         LIMIT 1`,
        [peds, itens]
    );
    if (sc2Ops.length > 0) {
        const r = sc2Ops[0];
        return { opBase: `${String(r.c2_num).trim()}${String(r.c2_item).trim()}${String(r.c2_sequen).trim()}`, origem: 'protheus' };
    }

    return { opBase: `${normPedido(pedido)}${normItem(item)}001`, origem: 'sem_op' };
}

/**
 * Travas do pedido/item. Retorna { motivos: [{ tipo, descricao, referencia }], apontado, opBase }.
 * Tipos: LOTE_LPF, LOTE_PCP, MESCLA, PLANO_CORTE, APONTAMENTO.
 */
async function getItemLocks(conn, pedido, item) {
    const peds = pedidoVariants(pedido);
    const itens = itemVariants(item);
    const motivos = [];

    // 1. Lote LPF (aberto ou liberado) — programações do item ou o item inteiro (notas)
    const lpfForecast = await queryOptional(conn,
        `SELECT DISTINCT TRIM(lpf_codigo) AS lpf FROM app_pcp_delivery_forecasts
         WHERE TRIM(pedido) IN (?) AND TRIM(item) IN (?) AND lpf_codigo IS NOT NULL AND TRIM(lpf_codigo) <> ''`,
        [peds, itens]
    );
    const lpfNotes = await queryOptional(conn,
        `SELECT DISTINCT TRIM(lpf_codigo) AS lpf FROM app_sales_order_item_notes
         WHERE TRIM(pedido) IN (?) AND TRIM(item) IN (?) AND lpf_codigo IS NOT NULL AND TRIM(lpf_codigo) <> ''`,
        [peds, itens]
    );
    const lpfCodes = [...new Set([...lpfForecast, ...lpfNotes].map(r => r.lpf).filter(Boolean))];
    if (lpfCodes.length > 0) {
        const releases = await queryOptional(conn,
            `SELECT codigo_liberacao, status FROM app_pcp_releases WHERE codigo_liberacao IN (?) OR lote_info IN (?)`,
            [lpfCodes, lpfCodes]
        );
        const statusByCode = new Map(releases.map(r => [String(r.codigo_liberacao || '').trim(), r.status]));
        lpfCodes.forEach(code => {
            const status = statusByCode.get(code) || 'ABERTO';
            motivos.push({ tipo: 'LOTE_LPF', referencia: code, descricao: `Lote de Fabricação ${code} (${status})` });
        });
    }

    // 2. Lote PCP (Engenharia)
    const lotesPcp = await queryOptional(conn,
        `SELECT DISTINCT l.lote_ref, l.status FROM app_pcp_lote_itens i
         JOIN app_pcp_lotes l ON l.id = i.lote_id
         WHERE TRIM(i.pedido) IN (?) AND TRIM(i.item) IN (?) AND COALESCE(l.status, '') <> 'CANCELADO'`,
        [peds, itens]
    );
    lotesPcp.forEach(l => motivos.push({ tipo: 'LOTE_PCP', referencia: l.lote_ref, descricao: `Lote PCP ${l.lote_ref} (${l.status || 'ABERTO'})` }));

    // 3. Plano de corte (não distingue frações: trava o item inteiro)
    const cortes = await queryOptional(conn,
        `SELECT DISTINCT c.numero_lote FROM app_lotes_corte_itens ci
         JOIN app_lotes_corte c ON c.id = ci.lote_corte_id
         WHERE TRIM(ci.pedido_pai) IN (?) AND TRIM(ci.item_pai) IN (?)`,
        [peds, itens]
    );
    cortes.forEach(c => motivos.push({ tipo: 'PLANO_CORTE', referencia: c.numero_lote, descricao: `Plano de corte ${c.numero_lote}` }));

    // 4. Liberação PCP (Mescla) e 5. apontamentos — dependem da OP do item
    const { opBase, origem } = await resolveItemOp(conn, pedido, item);
    let apontado = 0;
    if (opBase && origem !== 'sem_op') {
        const opBase8 = opBase.substring(0, 8);
        const c2Num = opBase.substring(0, 6);
        const c2Item = opBase.substring(6, 8);

        const mescla = await queryOptional(conn,
            `SELECT DISTINCT op_base FROM app_ind_producao_ativa WHERE op_base LIKE ?`,
            [`${opBase8}%`]
        );
        mescla.forEach(m => motivos.push({ tipo: 'MESCLA', referencia: m.op_base, descricao: `Liberação PCP (Mescla) da OP ${m.op_base}` }));

        const opNums = [...new Set([c2Num, String(parseInt(c2Num, 10) || c2Num)])];
        const apont = await queryOptional(conn,
            `SELECT COALESCE(SUM(quantidade), 0) AS total FROM app_production_appointments
             WHERE TRIM(op_numero) IN (?) AND TRIM(op_item) IN (?)
               AND COALESCE(conferencia_status, '') NOT IN ('CANCELADO', 'DIVERGENTE')`,
            [opNums, [c2Item, String(parseInt(c2Item, 10) || c2Item)]]
        );
        apontado += parseFloat(apont[0]?.total) || 0;

        const apontInd = await queryOptional(conn,
            `SELECT COALESCE(SUM(quantidade), 0) AS total FROM app_ind_production_appointments
             WHERE op_fracionada LIKE ? AND COALESCE(usuario, '') <> 'SISTEMA_HERANCA'`,
            [`${opBase8}%`]
        );
        apontado += parseFloat(apontInd[0]?.total) || 0;

        if (apontado > 0) {
            motivos.push({ tipo: 'APONTAMENTO', referencia: opBase, descricao: `Apontamento de produção iniciado na OP ${opBase} (${apontado.toLocaleString('pt-BR')} un. apontadas)` });
        }
    }

    return { motivos, apontado, opBase };
}

class OpBloqueadaError extends Error {
    constructor(acaoDescricao, motivos) {
        super(`Não é possível ${acaoDescricao}: ${motivos.map(m => m.descricao).join('; ')}. Somente a Data PCP pode ser alterada.`);
        this.status = 409;
        this.motivos = motivos;
    }
}

// Lança OpBloqueadaError se o item tiver qualquer trava
async function assertItemLivre(conn, pedido, item, acaoDescricao) {
    const locks = await getItemLocks(conn, pedido, item);
    if (locks.motivos.length > 0) throw new OpBloqueadaError(acaoDescricao, locks.motivos);
    return locks;
}

const usuarioDe = (req) => {
    const u = req?.user || {};
    return {
        id: u.id ?? null,
        nome: u.nome || u.name || null,
        login: u.login || u.username || null
    };
};

// Nome para gravar nas tabelas operacionais: o do login, não o enviado pela tela
const nomeUsuario = (req, fallback = 'Sistema') => {
    const u = usuarioDe(req);
    return u.nome || u.login || fallback;
};

/**
 * Grava uma linha de histórico. Usa a conexão da transação quando houver (grava junto com a ação).
 * Falha ao gravar o histórico não interrompe a operação (é registrada no log do servidor).
 */
async function registrarHistorico(conn, req, { acao, pedido, item, op, fracao, lote, descricao, antes, depois, origem }) {
    const u = usuarioDe(req);
    try {
        await (conn || mysqlPool).query(
            `INSERT INTO app_op_historico
                (pedido, item, op_numero, fracao, lote_codigo, acao, descricao, dados_antes, dados_depois, usuario_id, usuario_nome, usuario_login, origem)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                pedido != null ? normPedido(pedido) : null,
                item != null ? normItem(item) : null,
                op || null,
                fracao || null,
                lote || null,
                acao,
                descricao ? String(descricao).substring(0, 600) : null,
                antes !== undefined ? JSON.stringify(antes) : null,
                depois !== undefined ? JSON.stringify(depois) : null,
                u.id,
                u.nome,
                u.login,
                origem || (req ? `${req.method} ${req.baseUrl || ''}${req.route?.path || ''}` : null)
            ]
        );
    } catch (err) {
        console.error(`❌ [OP HISTÓRICO] Falha ao gravar ${acao} (${pedido}/${item}):`, err.message);
    }
}

// ── Apontamento por fração (Etapa 2) ────────────────────────────────────────

// Caminho inverso de resolveItemOp: a partir da OP (c2_num/c2_item do Protheus), acha o pedido/item de venda
async function resolvePedidoItemFromOp(conn, op_numero, op_item) {
    const opNums = [...new Set([String(op_numero ?? '').trim(), String(op_numero ?? '').trim().padStart(6, '0')])].filter(Boolean);
    const itens = itemVariants(op_item);
    if (opNums.length === 0 || itens.length === 0) return null;

    const sc2 = await queryOptional(conn,
        `SELECT TRIM(c2_pedido) AS pedido, TRIM(c2_itempv) AS item FROM sc2010
         WHERE TRIM(c2_num) IN (?) AND TRIM(c2_item) IN (?) LIMIT 1`,
        [opNums, itens]
    );
    if (sc2.length > 0 && sc2[0].pedido) return { pedido: sc2[0].pedido, item: sc2[0].item };

    const erp = await queryOptional(conn,
        `SELECT TRIM(pedido_venda) AS pedido, TRIM(item_pedido) AS item FROM erp_ordens_producao
         WHERE numero_op LIKE ? AND TRIM(item_pedido) IN (?) LIMIT 1`,
        [`${opNums[0]}%`, itens]
    );
    if (erp.length > 0 && erp[0].pedido) return { pedido: erp[0].pedido, item: erp[0].item };

    return null;
}

// Quantidade planejada da operação (mesma lógica de POST /production/appoint): Protheus (PG) com fallback MySQL
async function resolveQtdPlanejadaOperacao(conn, db, { op_numero, op_item, op_sequencia }) {
    try {
        const pgPromise = db.query(
            `SELECT c2.c2_quant::numeric AS qtd_planejada FROM public.sc2010 c2
             WHERE c2.c2_num = $1 AND c2.c2_item = $2 AND c2.c2_sequen = $3
             AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')`,
            [op_numero, op_item, op_sequencia]
        );
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('PG Timeout')), 1500));
        const pgRes = await Promise.race([pgPromise, timeoutPromise]);
        if (pgRes?.rows?.length > 0 && Number(pgRes.rows[0].qtd_planejada) > 0) {
            return Number(pgRes.rows[0].qtd_planejada);
        }
    } catch (_) { /* Postgres indisponível: cai no fallback MySQL */ }

    const opVariants = [...new Set([String(op_numero).trim(), String(op_numero).trim().padStart(6, '0')])];
    const itens = itemVariants(op_item);
    const seqs = [...new Set([String(op_sequencia || '001').trim(), String(op_sequencia || '001').trim().padStart(3, '0')])];

    const mySc = await queryOptional(conn,
        `SELECT CAST(c2_quant AS DECIMAL(15,4)) AS qtd_planejada FROM sc2010
         WHERE TRIM(c2_num) IN (?) AND TRIM(c2_item) IN (?) AND TRIM(c2_sequen) IN (?) LIMIT 1`,
        [opVariants, itens, seqs]
    );
    if (mySc.length > 0 && Number(mySc[0].qtd_planejada) > 0) return Number(mySc[0].qtd_planejada);

    const myErp = await queryOptional(conn,
        `SELECT CAST(quantidade_planejada AS DECIMAL(15,4)) AS qtd_planejada FROM erp_ordens_producao
         WHERE numero_op LIKE ? LIMIT 1`,
        [`${op_numero}%${op_item}%`]
    );
    if (myErp.length > 0 && Number(myErp[0].qtd_planejada) > 0) return Number(myErp[0].qtd_planejada);

    return 0;
}

/**
 * Saldo por fração PCP de uma operação. O item é "fracionado" quando tem mais de uma
 * programação (app_pcp_delivery_forecasts) — tanto para fração feita após a OP (AA, AB)
 * quanto para o item base de uma fração criada junto com a OP (01A, 01B).
 * A quantidade planejada de cada operação é rateada entre as frações na proporção da
 * quantidade de cada uma (mesmo cálculo usado nos geradores de PDF por fração).
 * Retorna { pedido, item, fracionado, fractions: [{ numero_lote, quantidade_pcp, data_entrega_pcp, planejado, apontado, saldo }] }.
 */
async function getFractionBalances(conn, db, { op_numero, op_item, op_sequencia = '001', operacao_codigo }) {
    const origem = await resolvePedidoItemFromOp(conn, op_numero, op_item);
    if (!origem) return { pedido: null, item: null, fracionado: false, fractions: [] };

    const progs = await queryOptional(conn,
        'SELECT id, numero_lote, quantidade_pcp, data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? ORDER BY id',
        [origem.pedido, origem.item]
    );
    if (progs.length <= 1) return { pedido: origem.pedido, item: origem.item, fracionado: false, fractions: [] };

    const totalFracionado = progs.reduce((s, p) => s + (parseFloat(p.quantidade_pcp) || 0), 0);
    if (totalFracionado <= 0) return { pedido: origem.pedido, item: origem.item, fracionado: false, fractions: [] };

    let qtdPlanejadaOperacao = 0;
    if (operacao_codigo) {
        qtdPlanejadaOperacao = await resolveQtdPlanejadaOperacao(conn, db, { op_numero, op_item, op_sequencia });
    }

    const opVariants = [...new Set([String(op_numero).trim(), String(op_numero).trim().padStart(6, '0')])];
    const itens = itemVariants(op_item);
    const seqs = [...new Set([String(op_sequencia || '001').trim(), String(op_sequencia || '001').trim().padStart(3, '0')])];
    const codes = operacao_codigo
        ? [...new Set([String(operacao_codigo).trim(), String(operacao_codigo).trim().padStart(2, '0')])]
        : null;

    const fractions = [];
    for (const p of progs) {
        const letra = p.numero_lote || getFractionLetter(progs.indexOf(p));
        const ratio = totalFracionado > 0 ? (parseFloat(p.quantidade_pcp) || 0) / totalFracionado : 0;
        const planejado = qtdPlanejadaOperacao * ratio;

        let apontado = 0;
        if (operacao_codigo) {
            const rows = await queryOptional(conn,
                `SELECT COALESCE(SUM(quantidade), 0) AS total FROM app_production_appointments
                 WHERE TRIM(op_numero) IN (?) AND TRIM(op_item) IN (?) AND TRIM(op_sequencia) IN (?) AND TRIM(operacao_codigo) IN (?)
                   AND fracao_pcp = ? AND COALESCE(conferencia_status, '') NOT IN ('CANCELADO', 'DIVERGENTE')`,
                [opVariants, itens, seqs, codes, letra]
            );
            apontado = parseFloat(rows[0]?.total) || 0;
        }

        fractions.push({
            numero_lote: letra,
            quantidade_pcp: parseFloat(p.quantidade_pcp) || 0,
            data_entrega_pcp: p.data_entrega_pcp,
            planejado: operacao_codigo ? Math.round(planejado * 10000) / 10000 : null,
            apontado: operacao_codigo ? apontado : null,
            saldo: operacao_codigo ? Math.max(0, Math.round((planejado - apontado) * 10000) / 10000) : null
        });
    }

    return { pedido: origem.pedido, item: origem.item, fracionado: true, fractions };
}

// Registra a tentativa bloqueada (fora da transação desfeita) e responde 409
async function responderBloqueio(res, req, err, { pedido, item, acaoTentada }) {
    await registrarHistorico(null, req, {
        acao: ACOES.ACAO_BLOQUEADA,
        pedido,
        item,
        descricao: `${acaoTentada} bloqueado: ${err.motivos.map(m => m.descricao).join('; ')}`,
        depois: { motivos: err.motivos }
    });
    return res.status(409).json({ error: err.message, bloqueios: err.motivos });
}

module.exports = {
    ACOES,
    normPedido,
    normItem,
    toOpBase11,
    getFractionLetter,
    resolveItemOp,
    resolvePedidoItemFromOp,
    getFractionBalances,
    getItemLocks,
    assertItemLivre,
    OpBloqueadaError,
    registrarHistorico,
    responderBloqueio,
    nomeUsuario
};
