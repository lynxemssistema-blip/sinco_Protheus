const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (App)

// Middleware de Log
router.use((req, res, next) => {
    console.log(`ðŸ“¦ [MATERIALS ROUTER] Hit: ${req.method} ${req.url}`);
    next();
});

// POST /api/materials/explosion - ExplosÃ£o de Materiais
router.post('/explosion', async (req, res) => {
    try {
        const { pedido, produto_codigo, quantidade_pedido } = req.body;

        console.log('ðŸ’¥ [EXPLOSION] Calculando materiais referecia:', { pedido, produto: produto_codigo, qtd: quantidade_pedido });

        // Se o produto nÃ£o for informado, mas temos o pedido, buscar items do pedido
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

        // Query Recursiva de ExplosÃ£o (Postgres)
        const query = `
            WITH RECURSIVE estrutura AS (
                -- NÃ­vel 0 (produto pai)
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
                
                -- NÃ­veis subsequentes (recursÃ£o)
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
                
                -- Dados da operaÃ§Ã£o (SG2)
                TRIM(g2.g2_operac) as codigo_operacao,
                TRIM(h1.h1_descri) as descricao_operacao,
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

            LEFT JOIN sh1010 h1
                ON h1.h1_codigo = g2.g2_recurso
                AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')

            LEFT JOIN sb2010 b2 
                ON TRIM(b2.b2_cod) = TRIM(e.componente)
                AND COALESCE(b2.d_e_l_e_t_, '') = ''

            GROUP BY 
                e.nivel, e.produto_pai, e.componente, 
                b1.b1_desc, b1.b1_tipo, b1.b1_um,
                e.qtd_unitaria, e.qtd_total, e.operacao, e.revisao,
                g2.g2_operac, h1.h1_descri, g2.g2_setup, g2.g2_tempo,
                b1.b1_custd

            ORDER BY 
                COALESCE(g2.g2_operac, '000') ASC,
                e.nivel ASC, 
                e.componente ASC
        `;

        const pgRes = await db.query(query, [produto_codigo, quantidade_pedido]);
        let materiais = pgRes.rows;

        // Enrichment: Buscar status de compra (Postgres)
        // OtimizaÃ§Ã£o: Fazer query de compras para os materiais retornados
        // Para simplificar, faremos um loop ou uma query WHERE IN

        // Vamos agrupar por operaÃ§Ã£o no backend
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
                    descricao: mat.descricao_operacao || 'SEM OPERAÃ‡ÃƒO DEFINIDA',
                    materiais: [],
                    resumo: { total_itens: 0, materiais_em_falta: 0 }
                };
            }

            // Calcular necessidade lÃ­quida
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
        console.error('âŒ [EXPLOSION ERROR]', err);
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

        // Buscar totais de solicitaÃ§Ãµes
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
    // Implementar lÃ³gica de salvar na tabela app_material_necessidades
    // ...
    res.json({ message: 'Necessidades atualizadas com sucesso' });
});

// GET /api/materials/where-used/:productCode - Onde Ã© Usado (Busca Reversa)
router.get('/where-used/:productCode', async (req, res) => {
    try {
        const { productCode } = req.params;

        console.log(`ðŸ” [WHERE-USED] Buscando onde Ã© usado: ${productCode}`);

        // Primeiro, buscar informaÃ§Ãµes bÃ¡sicas do produto
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
                error: 'Produto nÃ£o encontrado',
                productCode
            });
        }

        const productInfo = productInfoRes.rows[0];

        // Query Recursiva INVERSA (Ascendente) - Busca onde o produto Ã© usado
        const query = `
            WITH RECURSIVE onde_usado AS (
                -- NÃ­vel 0: produtos que utilizam diretamente o componente pesquisado
                SELECT 
                    0 as nivel,
                    TRIM(g1.g1_comp) as componente,
                    TRIM(g1.g1_cod) as produto_pai,
                    g1.g1_quant::numeric as quantidade
                FROM sg1010 g1
                WHERE TRIM(g1.g1_comp) = $1
                  AND COALESCE(g1.d_e_l_e_t_, '') = ''
                
                UNION ALL
                
                -- NÃ­veis subsequentes: produtos que utilizam os produtos do nÃ­vel anterior
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
            console.error('âš ï¸ Erro ao buscar documentos do produto pesquisado:', mysqlErr.message);
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
                console.error('âš ï¸ Erro ao buscar documentos dos produtos PAI:', mysqlErr.message);
                result.rows.forEach(row => {
                    row.tem_arquivos = false;
                    row.arquivos_count = 0;
                    row.primeiro_arquivo = null;
                });
            }
        }

        // Agrupar por nÃ­vel para facilitar visualizaÃ§Ã£o
        const porNivel = {};
        result.rows.forEach(row => {
            if (!porNivel[row.nivel]) {
                porNivel[row.nivel] = [];
            }
            porNivel[row.nivel].push(row);
        });

        console.log(`âœ… [WHERE-USED] Encontrados ${result.rows.length} usos em ${Object.keys(porNivel).length} nÃ­veis`);

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
        console.error('âŒ [WHERE-USED ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/materials/bulk-explosion - ExplosÃ£o Aglutinada (Bulk MRP)
router.post('/bulk-explosion', async (req, res) => {
    try {
        const { items } = req.body; // Array de { produto, qtd_total }
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item fornecido para explosÃ£o.' });
        }

        console.log(`ðŸ’¥ [BULK EXPLOSION] Iniciando explosÃ£o para ${items.length} itens base...`);

        // Transforma os itens em JSON string para passar pro Postgres jsonb_to_recordset
        const itemsJson = JSON.stringify(items);

        // Query Recursiva corrigida: saldo SB2 via CTE separada (evita subquery correlacionada no GROUP BY)
        const query = `
            WITH RECURSIVE estrutura AS (
                -- Nivel 0: raizes passadas no payload
                SELECT
                    0 AS nivel,
                    TRIM(g1.g1_cod)  AS produto_pai,
                    TRIM(g1.g1_comp) AS componente,
                    g1.g1_quant::numeric AS qtd_unitaria,
                    g1.g1_quant::numeric * i.qtd_total::numeric AS qtd_total
                FROM sg1010 g1
                JOIN jsonb_to_recordset($1::jsonb) AS i(produto text, qtd_total numeric)
                  ON TRIM(g1.g1_cod) = TRIM(i.produto)
                WHERE COALESCE(g1.d_e_l_e_t_, '') = ''

                UNION ALL

                -- Niveis subsequentes (recursao)
                SELECT
                    e.nivel + 1,
                    TRIM(e.componente),
                    TRIM(g1.g1_comp),
                    g1.g1_quant::numeric,
                    e.qtd_total * g1.g1_quant::numeric
                FROM estrutura e
                JOIN sg1010 g1 ON TRIM(g1.g1_cod) = TRIM(e.componente)
                WHERE COALESCE(g1.d_e_l_e_t_, '') = ''
                  AND e.nivel < 15
            ),
            -- Aglutina totais por componente (MP nivel folha)
            necessidades AS (
                SELECT
                    TRIM(e.componente)  AS codigo,
                    SUM(e.qtd_total)    AS qtd_total_necessaria
                FROM estrutura e
                JOIN sb1010 b1
                    ON TRIM(b1.b1_cod) = TRIM(e.componente)
                   AND COALESCE(b1.d_e_l_e_t_, '') = ''
                WHERE TRIM(b1.b1_tipo) IN ('MP', 'ME', 'MC', 'BN')
                GROUP BY TRIM(e.componente)
            ),
            -- Saldo Almoxarifado 01 (base de calculo da necessidade liquida)
            estoque_almox01 AS (
                SELECT
                    TRIM(b2.b2_cod) AS codigo,
                    SUM(COALESCE(b2.b2_qatu,0) - COALESCE(b2.b2_qemp,0) - COALESCE(b2.b2_reserva,0)) AS saldo
                FROM sb2010 b2
                WHERE TRIM(b2.b2_local) = '01'
                  AND COALESCE(b2.d_e_l_e_t_, '') = ''
                GROUP BY TRIM(b2.b2_cod)
            ),
            -- Saldo Almoxarifado 03 (informativo)
            estoque_almox03 AS (
                SELECT
                    TRIM(b2.b2_cod) AS codigo,
                    SUM(COALESCE(b2.b2_qatu,0) - COALESCE(b2.b2_qemp,0) - COALESCE(b2.b2_reserva,0)) AS saldo
                FROM sb2010 b2
                WHERE TRIM(b2.b2_local) = '03'
                  AND COALESCE(b2.d_e_l_e_t_, '') = ''
                GROUP BY TRIM(b2.b2_cod)
            )
            SELECT
                n.codigo,
                TRIM(b1.b1_desc)   AS descricao,
                TRIM(b1.b1_tipo)   AS tipo,
                TRIM(b1.b1_um)     AS unidade,
                n.qtd_total_necessaria,
                COALESCE(e01.saldo, 0) AS saldo_almox01,
                COALESCE(e03.saldo, 0) AS saldo_almox03
            FROM necessidades n
            JOIN sb1010 b1
                ON TRIM(b1.b1_cod) = n.codigo
               AND COALESCE(b1.d_e_l_e_t_, '') = ''
            LEFT JOIN estoque_almox01 e01 ON e01.codigo = n.codigo
            LEFT JOIN estoque_almox03 e03 ON e03.codigo = n.codigo
            ORDER BY n.codigo ASC
        `;

        const pgRes = await db.query(query, [itemsJson]);

        // Necessidade liquida calculada APENAS com base no Almox 01
        const resultados = pgRes.rows.map(mat => {
            const necessidade = Number(mat.qtd_total_necessaria) - Number(mat.saldo_almox01);
            return {
                ...mat,
                necessidade_liquida: Math.max(0, necessidade)
            };
        });

        console.log('[BULK EXPLOSION] Concluido. ' + resultados.length + ' MPs encontradas.');

        res.json({
            items_base: items.length,
            materiais: resultados
        });

    } catch (err) {
        console.error('â Œ [BULK EXPLOSION ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /api/materials/mrp-items - Busca leve de itens com saldo a faturar (sem enriquecimento)
router.get('/mrp-items', async (req, res) => {
    try {
        const {
            cliente = '', pedido = '', produto = '',
            dataInicial = '', dataFinal = '', dateType = 'pedido',
            tipo_item = '', page = 1, limit = 500
        } = req.query;

        const limitParsed = Math.min(parseInt(limit, 10) || 500, 2000);
        const pageParsed  = parseInt(page, 10) || 1;
        const offset      = (pageParsed - 1) * limitParsed;
        const params      = [];
        let pc = 1;

        let where = `WHERE COALESCE(c5.d_e_l_e_t_, '') = ''
          AND c5.c5_tipo <> 'B'
          AND COALESCE(c6.d_e_l_e_t_, '') = ''
          AND (COALESCE(c6.c6_qtdven,0) - COALESCE(c6.c6_qtdent,0)) > 0`;

        if (cliente) { where += ` AND sa1.a1_nome ILIKE '%' || $${pc} || '%'`; params.push(cliente); pc++; }
        if (pedido)  { where += ` AND TRIM(c5.c5_num) = $${pc}`;              params.push(pedido.trim().padStart(6, '0')); pc++; }
        if (produto) { where += ` AND TRIM(c6.c6_produto) ILIKE '%' || $${pc} || '%'`; params.push(produto.trim()); pc++; }

        if (dataInicial && dataFinal) {
            const di  = dataInicial.replace(/-/g, '');
            const df  = dataFinal.replace(/-/g, '');
            const col = dateType === 'entrega' ? 'c6.c6_entreg' : 'c5.c5_emissao';
            where += ` AND ${col} >= $${pc} AND ${col} <= $${pc + 1}`;
            params.push(di, df); pc += 2;
        }

        if (tipo_item) {
            const tipos = tipo_item.split(',').map(t => t.trim()).filter(Boolean);
            if (tipos.length > 0) {
                const phs = tipos.map(() => `$${pc++}`).join(', ');
                where += ` AND TRIM(sb1.b1_tipo) IN (${phs})`;
                params.push(...tipos);
            }
        }

        const limitPh  = pc;
        const offsetPh = pc + 1;
        params.push(limitParsed, offset);

        const sql = `
            SELECT COUNT(*) OVER() AS full_count,
                TRIM(c5.c5_num)     AS pedido,
                TRIM(c6.c6_item)    AS item,
                TRIM(c6.c6_produto) AS produto,
                TRIM(sb1.b1_desc)   AS descricao,
                TRIM(sb1.b1_tipo)   AS tipo,
                (COALESCE(c6.c6_qtdven,0) - COALESCE(c6.c6_qtdent,0))::numeric(18,4) AS qtd_faturar,
                COALESCE(c6.c6_qtdven,0)::numeric(18,4) AS qtd
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON c6.c6_filial = c5.c5_filial
               AND c6.c6_num    = c5.c5_num
               AND COALESCE(c6.d_e_l_e_t_,'') = ''
            LEFT JOIN public.sa1010 sa1
                ON sa1.a1_cod  = c5.c5_cliente
               AND sa1.a1_loja = c5.c5_lojacli
               AND COALESCE(sa1.d_e_l_e_t_,'') = ''
            LEFT JOIN public.sb1010 sb1
                ON sb1.b1_cod = c6.c6_produto
               AND COALESCE(sb1.d_e_l_e_t_,'') = ''
            ${where}
            ORDER BY c5.c5_num DESC, c6.c6_item ASC
            LIMIT $${limitPh} OFFSET $${offsetPh}
        `;

        console.log('[MRP-ITEMS] Pg=' + pageParsed + ' limit=' + limitParsed + ' params=' + params.length);
        const result = await db.query(sql, params);
        const total  = result.rows.length > 0 ? parseInt(result.rows[0].full_count, 10) : 0;
        res.json({ data: result.rows, meta: { total, page: pageParsed, limit: limitParsed } });

    } catch (err) {
        console.error('[MRP-ITEMS ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
