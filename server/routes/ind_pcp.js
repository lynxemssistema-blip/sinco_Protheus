const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (Local)
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

// Função auxiliar para formatar datas (YYYYMMDD) que vêm do Protheus
const parseProtheusDate = (dateString) => {
    if (!dateString || dateString.trim() === '') return null;
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}-${month}-${day}`;
};

// 1. Listar todas as OPs Pendentes (No Protheus, mas não no MySQL local)
router.get('/pending-ops', async (req, res) => {
    try {
        // Passo 1: Pegar as OPs do Protheus que estão válidas (abertas/recentes)
        const getInactiveFilter = await getInactiveOrdersFilter();
        const protheusQuery = `
            WITH ParentOPs AS (
                SELECT 
                    c2.c2_num,
                    c2.c2_pedido,
                    c2.c2_obs,
                    c2.c2_itempv
                FROM sc2010 c2
                WHERE c2.c2_sequen = '001'
                AND COALESCE(c2.D_E_L_E_T_, '') = ''
            )
            SELECT 
                TRIM(SC2.C2_NUM) AS c2_num,
                TRIM(SC2.C2_ITEM) AS c2_item,
                TRIM(SC2.C2_SEQUEN) AS c2_sequen,
                TRIM(SC2.C2_PRODUTO) AS c2_produto,
                SB1.B1_DESC AS descricao,
                SC2.C2_QUANT AS c2_quant,
                SC2.C2_DATPRI AS c2_datpri,
                TRIM(COALESCE(parent.c2_pedido, SC2.C2_PEDIDO)) AS pedido,
                TRIM(COALESCE(parent.c2_itempv, SC2.C2_ITEMPV)) AS item_pedido,
                SA1.A1_NOME AS cliente,
                TRIM(SC6.C6_PEDCLI) AS pedcli,
                SC6.C6_ENTREG AS c6_entreg,
                ((COALESCE(SC6.C6_QTDVEN, 0) - COALESCE(SC6.C6_QTDENT, 0))) AS qtd_saldo_faturar
            FROM sc2010 SC2
            LEFT JOIN ParentOPs parent ON parent.c2_num = SC2.C2_NUM
            LEFT JOIN sc6010 SC6 
                ON TRIM(parent.c2_pedido) = TRIM(SC6.C6_NUM) 
                AND parent.c2_itempv = SC6.C6_ITEM
                AND COALESCE(SC6.D_E_L_E_T_, '') = ''
            LEFT JOIN sc5010 SC5
                ON SC5.C5_NUM = TRIM(parent.c2_pedido)
                AND COALESCE(SC5.D_E_L_E_T_, '') = ''
            LEFT JOIN sa1010 SA1 
                ON SA1.A1_COD = SC5.C5_CLIENTE 
                AND SA1.A1_LOJA = SC5.C5_LOJACLI
                AND COALESCE(SA1.D_E_L_E_T_, '') = ''
            LEFT JOIN sb1010 SB1 
                ON SC2.C2_PRODUTO = SB1.B1_COD 
                AND COALESCE(SB1.D_E_L_E_T_, '') = ''
            WHERE COALESCE(SC2.D_E_L_E_T_, '') = ''
            AND SC2.C2_DATPRI >= '20240101'
            AND SC2.C2_QUANT > SC2.C2_QUJE
            ${getInactiveFilter('SC5.C5_NUM')}
            ORDER BY SC2.C2_DATPRI DESC
            LIMIT 2000
        `;
        
        console.log('[ind_pcp] Iniciando db.query (Protheus)...');
        const protheusResult = await db.query(protheusQuery);
        console.log('[ind_pcp] db.query finalizado. Linhas:', protheusResult.rows.length);
        
        let protheusOps = protheusResult.rows.map(op => ({
            op_base: `${op.c2_num}${op.c2_item}`, // Concatenação padrão do Protheus
            c2_num: op.c2_num,
            c2_item: op.c2_item,
            produto: op.c2_produto,
            descricao: op.descricao ? op.descricao.trim() : '',
            quantidade: parseFloat(op.c2_quant),
            pedido: op.pedido,
            item_pedido: op.item_pedido,
            cliente: op.cliente ? op.cliente.trim() : '',
            pedcli: op.pedcli ? op.pedcli.trim() : '',
            data_entrega_pv: parseProtheusDate(op.c6_entreg),
            qtd_saldo_faturar: parseFloat(op.qtd_saldo_faturar),
            data_prevista: parseProtheusDate(op.c2_datpri)
        }));

        console.log('[ind_pcp] Iniciando mysqlPool.query (MySQL)...');
        const [mysqlResult] = await mysqlPool.query(`
            SELECT DISTINCT op_base FROM app_ind_producao_ativa
        `);
        console.log('[ind_pcp] mysqlPool.query finalizado. Linhas:', mysqlResult.length);
        
        const liberadasArray = mysqlResult.map(row => row.op_base);

        // Passo 3: Mesclar (Filtrar). Retornar apenas as OPs que NÃO estão no `liberadasArray`
        const pendentes = protheusOps.filter(op => !liberadasArray.includes(op.op_base));

        res.json({
            success: true,
            total_protheus: protheusOps.length,
            total_ja_liberadas: liberadasArray.length,
            total_pendentes: pendentes.length,
            data: pendentes
        });

    } catch (error) {
        console.error('Erro ao buscar pending-ops:', error);
        res.status(500).json({ success: false, error: 'Erro interno ao buscar OPs pendentes.' });
    }
});

// 2. Liberar OP (Gravar na Tabela Local) - com suporte a fracionamento
router.post('/release-op', async (req, res) => {
    const { op_base, produto, descricao, quantidade_total, fracoes } = req.body;
    
    if (!op_base || !fracoes || !Array.isArray(fracoes)) {
        return res.status(400).json({ success: false, error: 'Parâmetros inválidos.' });
    }

    const connection = await mysqlPool.getConnection();
    try {
        await connection.beginTransaction();

        for (const fracao of fracoes) {
            const op_fracionada = `${op_base}${fracao.suf}`; 
            
            await connection.query(`
                INSERT INTO app_ind_producao_ativa 
                    (op_base, op_fracionada, produto, descricao, quantidade_total, quantidade_lote, status)
                VALUES 
                    (?, ?, ?, ?, ?, ?, 'LIBERADO')
            `, [
                op_base,
                op_fracionada,
                produto,
                descricao,
                quantidade_total,
                fracao.qtde
            ]);
        }

        // =========================================================================
        // HERANÇA DE APONTAMENTOS (WATERFALL ALLOCATION)
        // Se a OP Original já tinha apontamentos no app_production_appointments,
        // distribui essa quantidade entre as frações recém-criadas.
        // =========================================================================
        const c2_num = op_base.substring(0, 6);
        const c2_item = op_base.substring(6, 8) || '01';

        const [existingAppts] = await connection.query(`
            SELECT operacao_codigo, SUM(quantidade) as total
            FROM app_production_appointments
            WHERE op_numero = ? AND op_item = ?
            GROUP BY operacao_codigo
        `, [c2_num, c2_item]);

        if (existingAppts.length > 0) {
            for (const appt of existingAppts) {
                let remaining = Number(appt.total);
                
                for (const fracao of fracoes) {
                    if (remaining <= 0) break;
                    
                    const allocate = Math.min(remaining, Number(fracao.qtde));
                    const op_fracionada = `${op_base}${fracao.suf}`;
                    
                    await connection.query(`
                        INSERT INTO app_ind_production_appointments 
                            (op_fracionada, operacao_codigo, quantidade, usuario, status, data_inicio, data_fim)
                        VALUES (?, ?, ?, 'SISTEMA_HERANCA', 'FINALIZADO', NOW(), NOW())
                    `, [op_fracionada, appt.operacao_codigo, allocate]);

                    remaining -= allocate;
                }
            }
            console.log(`[HERANCA] Distribuídos apontamentos prévios da OP ${op_base} para as frações.`);
        }

        await connection.commit();
        res.json({ success: true, message: 'OP liberada e fracionada com sucesso no ambiente local.' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao liberar OP:', error);
        res.status(500).json({ success: false, error: 'Falha na inserção da OP na mescla local.' });
    } finally {
        connection.release();
    }
});

// 3. Listar OPs já liberadas na fábrica (Chão de Fábrica Visualização)
router.get('/active-lotes', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT * FROM app_ind_producao_ativa
            ORDER BY id DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Erro ao listar ativos:', error);
        res.status(500).json({ success: false, error: 'Falha ao recuperar lotes ativos.' });
    }
});

// 4. Painel de Controle de Apontamentos para OPs Fracionadas
router.get('/dashboard', async (req, res) => {
    try {
        // 1. Busca todos os lotes ativos locais
        const [lotes] = await mysqlPool.query(`
            SELECT 
                op_fracionada, op_base, produto, descricao, quantidade_total, quantidade_lote as c2_quant, status 
            FROM app_ind_producao_ativa 
            WHERE status != 'FINALIZADO'
            ORDER BY id DESC
        `);

        if (lotes.length === 0) {
            return res.json({ data: [], total: 0 });
        }

        // Extrai as OPs bases únicas para puxar no Protheus
        const opBases = [...new Set(lotes.map(l => l.op_base))].filter(Boolean);
        const produtosUnique = [...new Set(lotes.map(l => l.produto))].filter(Boolean);

        // 2. Busca roteiros (operações) no Protheus baseado nos produtos/ops
        let operationsMap = {};
        if (produtosUnique.length > 0) {
            const placeholders = produtosUnique.map((_, i) => `$${i + 1}`).join(',');
            const pgRes = await db.query(`
                SELECT 
                    TRIM(c2.c2_num) || TRIM(c2.c2_item) as op_base,
                    TRIM(c2.c2_num) as c2_num,
                    TRIM(c2.c2_item) as c2_item,
                    TRIM(c2.c2_sequen) as c2_sequen,
                    TRIM(g2.g2_operac) as g2_operac,
                    TRIM(g2.g2_descri) as g2_descri,
                    TRIM(g2.g2_recurso) as g2_recurso
                FROM sc2010 c2
                JOIN sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, ' ') = ' '
                WHERE btrim(c2.c2_produto) IN (${placeholders})
                AND COALESCE(c2.d_e_l_e_t_, ' ') = ' '
            `, produtosUnique);

            pgRes.rows.forEach(row => {
                const base = row.op_base;
                if (!operationsMap[base]) operationsMap[base] = [];
                // Evita duplicatas de operações
                if (!operationsMap[base].find(o => o.g2_operac === row.g2_operac)) {
                    operationsMap[base].push({
                        ...row,
                        produzido: 0 // Será preenchido
                    });
                }
            });
        }

        // 3. Busca apontamentos de fração locais E apontamentos globais
        // Para considerar o que já foi apontado (soma do fracionado + global da base se necessário)
        const [apontamentosGlobais] = await mysqlPool.query(`
            SELECT op_numero, op_item, operacao_codigo, SUM(quantidade) as total
            FROM app_production_appointments
            GROUP BY op_numero, op_item, operacao_codigo
        `);
        const [apontamentosFrac] = await mysqlPool.query(`
            SELECT op_fracionada, operacao_codigo, SUM(quantidade) as total
            FROM app_ind_production_appointments
            GROUP BY op_fracionada, operacao_codigo
        `);

        // 4. Mescla os dados para montar o payload compatível com o frontend (lista PLANA de operações)
        let flatOperations = [];
        
        lotes.forEach(lote => {
            const baseOps = operationsMap[lote.op_base] || [];
            
            let c2_num = lote.op_base;
            let c2_item = '01'; // Default
            let c2_sequen = '001';
            
            if (baseOps.length > 0) {
                c2_num = baseOps[0].c2_num;
                c2_item = baseOps[0].c2_item;
                c2_sequen = baseOps[0].c2_sequen;
            } else if (lote.op_base.length >= 8) {
                c2_num = lote.op_base.substring(0, 6);
                c2_item = lote.op_base.substring(6, 8);
            }

            baseOps.forEach(op => {
                const fracMatch = apontamentosFrac.find(a => a.op_fracionada === lote.op_fracionada && a.operacao_codigo === op.g2_operac);
                const produzidoFracionado = fracMatch ? Number(fracMatch.total) : 0;
                
                const globalMatch = apontamentosGlobais.find(a => (a.op_numero + a.op_item) === lote.op_base && a.operacao_codigo === op.g2_operac);
                const produzidoMae = globalMatch ? Number(globalMatch.total) : 0;

                flatOperations.push({
                    id_unique: `${lote.op_fracionada}-${op.g2_operac}`,
                    op: c2_num,
                    item_op: c2_item,
                    sequen: c2_sequen,
                    op_fracionada: lote.op_fracionada, // Flag vital!
                    op_base: lote.op_base,
                    
                    operacao: op.g2_operac,
                    desc_operacao: op.g2_descri,
                    recurso: op.g2_recurso,
                    
                    cod_produto_op: lote.produto,
                    desc_produto: lote.descricao,
                    
                    nome_cliente: 'LOTE INTERNO FRACIONADO',
                    pedido_venda: lote.op_fracionada, // Mostrar o Lote como Pedido ajuda visualmente
                    ped_cliente: lote.status,
                    
                    qtd_planejada_op: Number(lote.c2_quant),
                    qtd_produzida_real: produzidoFracionado,
                    produzido_mae: produzidoMae,
                    
                    data_planejada_inicio: null,
                    data_planejada_fim: null
                });
            });
        });

        const data = flatOperations.sort((a, b) => b.op_fracionada.localeCompare(a.op_fracionada) || a.operacao.localeCompare(b.operacao));

        res.json({ data, total: data.length });
    } catch (error) {
        console.error('Erro ao montar dashboard ind_pcp:', error);
        res.status(500).json({ error: 'Falha ao recuperar dashboard fracionado.' });
    }
});

module.exports = router;
