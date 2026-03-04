const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (App)

// Middleware de Log
router.use((req, res, next) => {
    console.log(`📦 [MATERIALS ROUTER] Hit: ${req.method} ${req.url}`);
    next();
});

// POST /api/materials/explosion - Explosão de Materiais
router.post('/explosion', async (req, res) => {
    try {
        const { pedido, produto_codigo, quantidade_pedido } = req.body;

        console.log('💥 [EXPLOSION] Calculando materiais referecia:', { pedido, produto: produto_codigo, qtd: quantidade_pedido });

        // Se o produto não for informado, mas temos o pedido, buscar items do pedido
        if (!produto_codigo && pedido) {
            const itemsQuery = `
                SELECT 
                    TRIM(C6_ITEM) as item,
                    TRIM(C6_PRODUTO) as produto,
                    TRIM(C6_DESCRI) as descricao,
                    C6_QTDVEN as qtd
                FROM sc6010 
                WHERE TRIM(C6_NUM) = $1
                AND COALESCE(D_E_L_E_t_, '') = ''
                ORDER BY C6_ITEM
             `;
            const itemsRes = await db.query(itemsQuery, [pedido]);
            return res.json({
                multiplo_items: true,
                items: itemsRes.rows
            });
        }

        // Query Recursiva de Explosão (Postgres)
        const query = `
            WITH RECURSIVE estrutura AS (
                -- Nível 0 (produto pai)
                SELECT 
                    0 as nivel,
                    TRIM(g1.g1_cod) as produto_pai,
                    TRIM(g1.g1_comp) as componente,
                    g1.g1_quant::numeric as qtd_unitaria,
                    g1.g1_quant::numeric * $2::numeric as qtd_total,
                    TRIM(g1.g1_oper) as operacao,
                    TRIM(g1.g1_revini) as revisao
                FROM sg1010 g1
                WHERE TRIM(g1.g1_cod) = $1
                  AND COALESCE(g1.d_e_l_e_t_, '') = ''
                
                UNION ALL
                
                -- Níveis subsequentes (recursão)
                SELECT
                    e.nivel + 1,
                    TRIM(e.componente) as produto_pai,
                    TRIM(g1.g1_comp) as componente,
                    g1.g1_quant::numeric as qtd_unitaria,
                    e.qtd_total * g1.g1_quant::numeric as qtd_total,
                    TRIM(g1.g1_oper) as operacao,
                    TRIM(g1.g1_revini) as revisao
                FROM estrutura e
                JOIN sg1010 g1 ON TRIM(g1.g1_cod) = TRIM(e.componente)
                WHERE COALESCE(g1.d_e_l_e_t_, '') = ''
                  AND e.nivel < 10
            )
            SELECT 
                e.nivel,
                e.produto_pai,
                e.componente,
                TRIM(b1.b1_desc) as descricao,
                TRIM(b1.b1_tipo) as tipo,
                TRIM(b1.b1_um) as unidade,
                e.qtd_unitaria,
                e.qtd_total,
                e.operacao,
                e.revisao,
                
                -- Dados da operação (SG2)
                TRIM(g2.g2_operac) as codigo_operacao,
                TRIM(g2.g2_descri) as descricao_operacao,
                g2.g2_setup::numeric as tempo_setup,
                g2.g2_tempo::numeric as tempo_processamento,
                
                -- Saldo de estoque (SB2)
                COALESCE(SUM(b2.b2_qatu - b2.b2_qemp - b2.b2_reserva), 0) as saldo_disponivel,
                
                -- Custo (SB1)
                COALESCE(b1.b1_custd, 0)::numeric as custo_unitario,
                COALESCE(b1.b1_custd, 0)::numeric * e.qtd_total as custo_total_estimado

            FROM estrutura e

            LEFT JOIN sb1010 b1 
                ON TRIM(b1.b1_cod) = TRIM(e.componente)
                AND COALESCE(b1.d_e_l_e_t_, '') = ''

            LEFT JOIN sg2010 g2 
                ON TRIM(g2.g2_produto) = TRIM(e.produto_pai)
                AND TRIM(g2.g2_codigo) = TRIM(e.operacao)
                AND COALESCE(g2.d_e_l_e_t_, '') = ''

            LEFT JOIN sb2010 b2 
                ON TRIM(b2.b2_cod) = TRIM(e.componente)
                AND COALESCE(b2.d_e_l_e_t_, '') = ''

            GROUP BY 
                e.nivel, e.produto_pai, e.componente, 
                b1.b1_desc, b1.b1_tipo, b1.b1_um,
                e.qtd_unitaria, e.qtd_total, e.operacao, e.revisao,
                g2.g2_operac, g2.g2_descri, g2.g2_setup, g2.g2_tempo,
                b1.b1_custd

            ORDER BY 
                COALESCE(g2.g2_operac, '000') ASC,
                e.nivel ASC, 
                e.componente ASC
        `;

        const pgRes = await db.query(query, [produto_codigo, quantidade_pedido]);
        let materiais = pgRes.rows;

        // Enrichment: Buscar status de compra (Postgres)
        // Otimização: Fazer query de compras para os materiais retornados
        // Para simplificar, faremos um loop ou uma query WHERE IN

        // Vamos agrupar por operação no backend
        const porOperacao = {};

        for (const mat of materiais) {
            // Se for materia prima (MP, ME, MC), buscar dados de compra
            if (['MP', 'ME', 'MC', 'BN'].includes(mat.tipo)) {

                // Query de compras simplificada (pega a mais recente)
                const compraRes = await db.query(`
                    SELECT 
                        TRIM(c1.c1_num) as sc_numero,
                        TRIM(c7.c7_num) as pc_numero,
                        TRIM(d1.d1_doc) as nf_numero,
                         TO_CHAR(TO_DATE(c7.c7_datprf, 'YYYYMMDD'), 'YYYY-MM-DD') as data_entrega,
                        c7.c7_preco::numeric as preco_unitario
                    FROM sb1010 b1
                    LEFT JOIN sc1010 c1 ON TRIM(c1.c1_produto) = TRIM(b1.b1_cod) AND COALESCE(c1.d_e_l_e_t_, '') = ''
                    LEFT JOIN sc7010 c7 ON TRIM(c7.c7_numsc) = TRIM(c1.c1_num) AND TRIM(c7.c7_itemsc) = TRIM(c1.c1_item) AND COALESCE(c7.d_e_l_e_t_, '') = ''
                    LEFT JOIN sd1010 d1 ON TRIM(d1.d1_pedido) = TRIM(c7.c7_num) AND TRIM(d1.d1_itempc) = TRIM(c7.c7_item) AND COALESCE(d1.d_e_l_e_t_, '') = ''
                    WHERE TRIM(b1.b1_cod) = $1
                    ORDER BY c1.c1_datprf DESC LIMIT 1
                `, [mat.componente]);

                if (compraRes.rows.length > 0) {
                    const compra = compraRes.rows[0];
                    mat.status_compra = compra.nf_numero ? 'RECEBIDO' : (compra.pc_numero ? 'PEDIDO_COMPRA' : (compra.sc_numero ? 'SOLICITACAO' : 'PENDENTE'));
                    mat.compra = compra;
                } else {
                    mat.status_compra = 'PENDENTE';
                }
            }

            // Agrupamento
            const opKey = mat.codigo_operacao || '000';
            if (!porOperacao[opKey]) {
                porOperacao[opKey] = {
                    operacao: opKey,
                    descricao: mat.descricao_operacao || 'SEM OPERAÇÃO DEFINIDA',
                    materiais: [],
                    resumo: { total_itens: 0, materiais_em_falta: 0 }
                };
            }

            // Calcular necessidade líquida
            mat.necessidade_liquida = Math.max(0, mat.qtd_total - mat.saldo_disponivel);

            porOperacao[opKey].materiais.push(mat);
            porOperacao[opKey].resumo.total_itens++;
            if (mat.necessidade_liquida > 0) porOperacao[opKey].resumo.materiais_em_falta++;
        }

        res.json({
            pedido: { numero: pedido, produto: produto_codigo, qtd: quantidade_pedido },
            lista_plana: materiais,
            por_operacao: Object.values(porOperacao).sort((a, b) => a.operacao.localeCompare(b.operacao))
        });

    } catch (err) {
        console.error('❌ [EXPLOSION ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/materials/dashboard - Dashboard Gerencial
router.get('/dashboard', async (req, res) => {
    try {
        const { days = 30 } = req.query;

        // Buscar alertas da tabela MySQL
        const [alertas] = await mysqlPool.execute(`
            SELECT * FROM app_material_necessidades 
            WHERE criticidade != 'OK' 
            ORDER BY dias_ate_necessidade ASC
            LIMIT 50
        `);

        // Buscar totais de solicitações
        const [solicitacoes] = await mysqlPool.execute(`
            SELECT status, COUNT(*) as qtd 
            FROM app_solicitacoes_almoxarifado 
            GROUP BY status
        `);

        res.json({
            alertas_criticos: alertas,
            solicitacoes_resumo: solicitacoes
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/materials/upload-needs - Salvar necessidades calculadas (Alertas)
router.post('/upload-needs', async (req, res) => {
    // Implementar lógica de salvar na tabela app_material_necessidades
    // ...
    res.json({ message: 'Necessidades atualizadas com sucesso' });
});

// GET /api/materials/where-used/:productCode - Onde é Usado (Busca Reversa)
router.get('/where-used/:productCode', async (req, res) => {
    try {
        const { productCode } = req.params;

        console.log(`🔍 [WHERE-USED] Buscando onde é usado: ${productCode}`);

        // Primeiro, buscar informações básicas do produto
        const productInfoQuery = `
            SELECT 
                TRIM(b1_cod) as codigo,
                TRIM(b1_desc) as descricao,
                TRIM(b1_tipo) as tipo,
                TRIM(b1_um) as unidade
            FROM sb1010
            WHERE TRIM(b1_cod) = $1
            AND COALESCE(d_e_l_e_t_, '') = ''
        `;
        const productInfoRes = await db.query(productInfoQuery, [productCode]);

        if (productInfoRes.rows.length === 0) {
            return res.status(404).json({
                error: 'Produto não encontrado',
                productCode
            });
        }

        const productInfo = productInfoRes.rows[0];

        // Query Recursiva INVERSA (Ascendente) - Busca onde o produto é usado
        const query = `
            WITH RECURSIVE onde_usado AS (
                -- Nível 0: produtos que utilizam diretamente o componente pesquisado
                SELECT 
                    0 as nivel,
                    TRIM(g1.g1_comp) as componente,
                    TRIM(g1.g1_cod) as produto_pai,
                    g1.g1_quant::numeric as quantidade
                FROM sg1010 g1
                WHERE TRIM(g1.g1_comp) = $1
                  AND COALESCE(g1.d_e_l_e_t_, '') = ''
                
                UNION ALL
                
                -- Níveis subsequentes: produtos que utilizam os produtos do nível anterior
                SELECT
                    ou.nivel + 1,
                    TRIM(ou.produto_pai) as componente,
                    TRIM(g1.g1_cod) as produto_pai,
                    g1.g1_quant::numeric as quantidade
                FROM onde_usado ou
                JOIN sg1010 g1 ON TRIM(g1.g1_comp) = TRIM(ou.produto_pai)
                WHERE COALESCE(g1.d_e_l_e_t_, '') = ''
                  AND ou.nivel < 10
            )
            SELECT 
                ou.nivel,
                ou.componente,
                ou.produto_pai,
                TRIM(b1.b1_desc) as descricao_produto_pai,
                TRIM(b1.b1_tipo) as tipo,
                TRIM(b1.b1_um) as unidade,
                ou.quantidade
            FROM onde_usado ou
            LEFT JOIN sb1010 b1 
                ON TRIM(b1.b1_cod) = TRIM(ou.produto_pai)
                AND COALESCE(b1.d_e_l_e_t_, '') = ''
            ORDER BY ou.nivel ASC, ou.produto_pai ASC
        `;

        const result = await db.query(query, [productCode]);

        // --- ENRICHMENT: Buscar arquivos PDF do MySQL para o produto pesquisado ---
        try {
            const [prodDocs] = await mysqlPool.execute(
                'SELECT COUNT(*) as count, MIN(url_arquivo) as first_file FROM produtos_docs WHERE produto_codigo = ?',
                [productCode]
            );
            if (prodDocs[0].count > 0) {
                productInfo.tem_arquivos = true;
                productInfo.arquivos_count = parseInt(prodDocs[0].count);
                productInfo.primeiro_arquivo = prodDocs[0].first_file;
            } else {
                productInfo.tem_arquivos = false;
                productInfo.arquivos_count = 0;
                productInfo.primeiro_arquivo = null;
            }
        } catch (mysqlErr) {
            console.error('⚠️ Erro ao buscar documentos do produto pesquisado:', mysqlErr.message);
            productInfo.tem_arquivos = false;
            productInfo.arquivos_count = 0;
            productInfo.primeiro_arquivo = null;
        }

        // --- ENRICHMENT: Buscar arquivos PDF do MySQL para produtos PAI ---
        if (result.rows.length > 0) {
            try {
                const codigos = [...new Set(result.rows.map(r => r.produto_pai))];
                const placeholders = codigos.map(() => '?').join(',');

                const [docs] = await mysqlPool.execute(
                    `SELECT produto_codigo, COUNT(*) as count, MIN(url_arquivo) as first_file 
                     FROM produtos_docs 
                     WHERE produto_codigo IN (${placeholders}) 
                     GROUP BY produto_codigo`,
                    codigos
                );

                const docsMap = {};
                docs.forEach(d => {
                    docsMap[d.produto_codigo] = {
                        tem_arquivos: true,
                        arquivos_count: parseInt(d.count),
                        primeiro_arquivo: d.first_file
                    };
                });

                result.rows.forEach(row => {
                    const docInfo = docsMap[row.produto_pai];
                    if (docInfo) {
                        row.tem_arquivos = true;
                        row.arquivos_count = docInfo.arquivos_count;
                        row.primeiro_arquivo = docInfo.primeiro_arquivo;
                    } else {
                        row.tem_arquivos = false;
                        row.arquivos_count = 0;
                        row.primeiro_arquivo = null;
                    }
                });
            } catch (mysqlErr) {
                console.error('⚠️ Erro ao buscar documentos dos produtos PAI:', mysqlErr.message);
                result.rows.forEach(row => {
                    row.tem_arquivos = false;
                    row.arquivos_count = 0;
                    row.primeiro_arquivo = null;
                });
            }
        }

        // Agrupar por nível para facilitar visualização
        const porNivel = {};
        result.rows.forEach(row => {
            if (!porNivel[row.nivel]) {
                porNivel[row.nivel] = [];
            }
            porNivel[row.nivel].push(row);
        });

        console.log(`✅ [WHERE-USED] Encontrados ${result.rows.length} usos em ${Object.keys(porNivel).length} níveis`);

        res.json({
            productCode: productInfo.codigo,
            description: productInfo.descricao,
            tipo: productInfo.tipo,
            unidade: productInfo.unidade,
            usedIn: result.rows,
            usedInByLevel: porNivel,
            totalUsages: result.rows.length,
            levels: Object.keys(porNivel).length
        });

    } catch (err) {
        console.error('❌ [WHERE-USED ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
