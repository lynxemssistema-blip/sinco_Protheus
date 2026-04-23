const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (Local)

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
        const protheusQuery = `
            SELECT 
                TRIM(SC2.C2_NUM) AS c2_num,
                TRIM(SC2.C2_ITEM) AS c2_item,
                TRIM(SC2.C2_SEQUEN) AS c2_sequen,
                TRIM(SC2.C2_PRODUTO) AS c2_produto,
                SB1.B1_DESC AS descricao,
                SC2.C2_QUANT AS c2_quant,
                SC2.C2_DATPRI AS c2_datpri,
                TRIM(COALESCE(SC6.C6_NUM, SC2.C2_PEDIDO)) AS pedido,
                TRIM(COALESCE(SC6.C6_ITEM, SC2.C2_ITEMPV)) AS item_pedido,
                SA1.A1_NOME AS cliente,
                TRIM(SC6.C6_PEDCLI) AS pedcli,
                SC6.C6_ENTREG AS c6_entreg,
                ((COALESCE(SC6.C6_QTDVEN, 0) - COALESCE(SC6.C6_QTDENT, 0))) AS qtd_saldo_faturar
            FROM sc2010 SC2
            LEFT JOIN sc6010 SC6 
                ON SC2.C2_PEDIDO = SC6.C6_NUM 
                AND SC2.C2_ITEMPV = SC6.C6_ITEM
                AND COALESCE(SC6.D_E_L_E_T_, '') = ''
            LEFT JOIN sc5010 SC5
                ON SC5.C5_NUM = SC6.C6_NUM
                AND SC5.C5_FILIAL = SC6.C6_FILIAL
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
            AND SC2.C2_QUANT > 0
            AND (COALESCE(SC6.C6_QTDVEN, 0) - COALESCE(SC6.C6_QTDENT, 0)) > 0
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
    
    // fracoes = [{ suf: 'A', qtde: 10 }, { suf: 'B', qtde: 5 }] 

    if (!op_base || !fracoes || !Array.isArray(fracoes)) {
        return res.status(400).json({ success: false, error: 'Parâmetros inválidos.' });
    }

    const connection = await mysqlPool.getConnection();
    try {
        await connection.beginTransaction();

        for (const fracao of fracoes) {
            const op_fracionada = `${op_base}${fracao.suf}`; // Ex: 1000501-A ou só 1000501 se não tiver suf
            
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

module.exports = router;
