const express = require('express');
const router = express.Router();
console.log('🔄 [DEBUG] Carregando arquivo routes/producao.js');
const db = require('../db');
const mysqlPool = require('../services/mysqlService'); // Importar conexão MySQL

// GET /api/producao/ordens
router.get('/ordens', async (req, res) => {
  try {
    const { pedido } = req.query;
    let queryParams = [];
    let filterClause = '';

    if (pedido) {
      queryParams.push(pedido);
      filterClause = `AND c5.c5_num = $${queryParams.length}`;
    }

    const sql = `
WITH RECURSIVE
pedido_itens AS (
  SELECT
    c5.c5_num               AS pedido,
    c6.c6_item              AS item,
    c6.c6_produto           AS produto_item,
    (c6.c6_qtdven::numeric) AS qtd_item,

    c5.c5_cliente           AS cod_cliente,
    c5.c5_lojacli           AS loja_cliente,
    a1.a1_nome              AS nomecliente,

    CASE
      WHEN btrim(c6.c6_item) ~ '^[0-9]+$' THEN lpad(btrim(c6.c6_item), 6, '0')
      ELSE btrim(c6.c6_item)
    END AS item_ord,

    TRIM(c6.c6_pedcli) AS ped_cliente, -- New field

    -- OP(s) relacionadas ao item do pedido (SC2)
    c2.c2_num AS ops,
    c2.c2_num AS op_primeira

  FROM public.sc5010 c5
  JOIN public.sc6010 c6
    ON c6.c6_filial = c5.c5_filial
   AND c6.c6_num    = c5.c5_num

  LEFT JOIN public.sa1010 a1
    ON a1.a1_cod     = c5.c5_cliente
   AND a1.a1_loja    = c5.c5_lojacli
   AND a1.d_e_l_e_t_ = ' '

  LEFT JOIN public.sc2010 c2
    ON c2.d_e_l_e_t_ = ' '
   AND c2.c2_filial  = c6.c6_filial
   AND c2.c2_pedido  = c6.c6_num  -- Critical Fix: Link to Order Number
   AND c2.c2_itempv  = c6.c6_item
   AND c2.c2_produto = c6.c6_produto

  WHERE
    c5.d_e_l_e_t_ = ' '
    AND c6.d_e_l_e_t_ = ' '
    AND btrim(c6.c6_item) ~ '^[0-9]+$'
    AND c5.c5_tipo <> 'B'
    -- Updated Filter: Allow Released (S) but exclude Fully Billed (S + Note)
    AND NOT (c5.c5_liberok = 'S' AND COALESCE(c5.c5_nota, '') <> '')
    ${filterClause}
),

arvore AS (
  -- nível 0 (raiz)
  SELECT
    pi.pedido,
    pi.item,
    pi.item_ord,
    pi.produto_item,
    pi.cod_cliente,
    pi.loja_cliente,
    pi.nomecliente,
    pi.ops,
    pi.op_primeira,
    pi.ped_cliente,

    0 AS nivel,
    pi.produto_item::text AS cod_atual,
    NULL::text            AS cod_pai,
    1::numeric            AS fator_rel,
    pi.produto_item::text AS caminho,
    pi.qtd_item
  FROM pedido_itens pi

  UNION ALL

  -- níveis seguintes (BOM)
  SELECT
    a.pedido,
    a.item,
    a.item_ord,
    a.produto_item,
    a.cod_cliente,
    a.loja_cliente,
    a.nomecliente,
    a.ops,
    a.op_primeira,
    a.ped_cliente,

    a.nivel + 1 AS nivel,
    g1.g1_comp::text AS cod_atual,
    g1.g1_cod::text  AS cod_pai,
    a.fator_rel * (REPLACE(g1.g1_quant::text, ',', '.')::numeric) AS fator_rel,
    (a.caminho || ' > ' || g1.g1_comp) AS caminho,
    a.qtd_item
  FROM arvore a
  JOIN public.sg1010 g1
    ON g1.g1_cod = a.cod_atual
   AND g1.d_e_l_e_t_ = ' '
  WHERE a.nivel < 20
)

SELECT
  a.pedido,
  a.item,
  a.item_ord,

  -- OP(s)
  a.ops,
  a.op_primeira,

  a.cod_cliente,
  a.loja_cliente,
  a.nomecliente,
  a.ped_cliente,

  a.qtd_item                 AS qtditem,
  a.produto_item             AS codprodutoitem,

  a.nivel,
  a.cod_pai                  AS codpaiestrutura,
  b_pai.b1_desc              AS descpaiestrutura,

  a.cod_atual                AS codnoarvore,
  b_atual.b1_desc            AS descnoarvore,

  a.fator_rel                AS qtdrelativabom,
  (a.fator_rel * a.qtd_item) AS qtdtotalparaopedido,
  a.caminho
FROM arvore a
LEFT JOIN public.sb1010 b_pai
  ON b_pai.b1_cod = a.cod_pai
 AND b_pai.d_e_l_e_t_ = ' '
LEFT JOIN public.sb1010 b_atual
  ON b_atual.b1_cod = a.cod_atual
 AND b_atual.d_e_l_e_t_ = ' '
ORDER BY
  a.pedido,
  a.item_ord,
  a.nivel,
  a.caminho
LIMIT 2000;
        `;

    const result = await db.query(sql, queryParams);

    // --- ENRICHMENT DO MYSQL (Verificar documentos) ---
    const rows = result.rows;
    if (rows.length > 0) {
      try {
        // Coletar códigos dos produtos na árvore (codnoarvore)
        // Filtra nulos e remove duplicados para a query
        const codigos = [...new Set(rows.map(r => r.codnoarvore).filter(c => c))];

        if (codigos.length > 0) {
          const placeholders = codigos.map(() => '?').join(',');

          // Busca documentos (trazendo todos para contar e pegar o primeiro)
          const [docsResult] = await mysqlPool.execute(
            `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
            codigos
          );

          // Agrupar por produto
          const docsMap = {};
          docsResult.forEach(d => {
            if (!docsMap[d.produto_codigo]) {
              docsMap[d.produto_codigo] = [];
            }
            docsMap[d.produto_codigo].push(d);
          });

          // Adicionar info aos resultados
          rows.forEach(r => {
            const docs = docsMap[r.codnoarvore] || [];
            r.tem_arquivos = docs.length > 0;
            r.arquivos_count = docs.length;
            r.primeiro_arquivo = docs.length > 0 ? docs[0].url_arquivo : null;
          });
        }
      } catch (mysqlErr) {
        console.error('⚠️ Erro ao verificar documentos no MySQL para OP:', mysqlErr.message);
        // Segue sem travar a request principal
      }
    }

    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar ordens de produção:', err);
    res.status(500).json({ error: 'Erro interno ao buscar dados de produção' });
  }
});

// GET /api/producao/op - Buscar estrutura por OP
router.get('/op', async (req, res) => {
  try {
    const { op, item, sequencia, client, product } = req.query;

    // Validation: Require at least ONE filter
    if (!op && !item && (!client || client.length < 3) && (!product || product.length < 3)) {
      return res.status(400).json({ error: 'Informe pelo menos um filtro: OP, Item, Cliente (min 3 chars) ou Produto (min 3 chars).' });
    }

    // Dynamic Parameter Building
    const params = [];
    let paramCount = 1;

    let whereClause = "WHERE c2.d_e_l_e_t_ = ' ' ";

    if (op) {
      params.push(`%${op}%`);
      whereClause += `AND (c2.c2_num LIKE $${paramCount} OR c2.c2_pedido LIKE $${paramCount} OR c2.c2_obs LIKE $${paramCount}) `;
      paramCount++;
    }

    if (item) {
      params.push(`%${item}%`);
      whereClause += `AND c2.c2_item LIKE $${paramCount++} `;
    }

    if (sequencia) {
      params.push(`%${sequencia}%`);
      whereClause += `AND c2.c2_sequen LIKE $${paramCount++} `;
    }

    if (product) {
      params.push(`%${product.toUpperCase()}%`);
      whereClause += `AND TRIM(c2.c2_produto) ILIKE $${paramCount++} `;
    }

    // Client Filter: Requires subquery/exists specific to Postgres + Protheus SC5 structure
    if (client) {
      params.push(`%${client.toUpperCase()}%`);
      // Check if the OP's linked Order (c2_pedido) belongs to a client with matching Name or Code
      // We join SC5 on Order Number (c5_num) and Filial (assuming shared filial context or ignoring for simplicity)
      whereClause += `
            AND EXISTS (
                SELECT 1 
                FROM public.sc5010 c5
                LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.a1_loja = c5.c5_lojacli
                WHERE c5.d_e_l_e_t_ = ' ' 
                AND a1.d_e_l_e_t_ = ' '
                AND TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
                AND (a1.a1_nome ILIKE $${paramCount} OR a1.a1_cod ILIKE $${paramCount})
            )
        `;
      paramCount++;
    }

    const sql = `
WITH RECURSIVE
op_base AS (
  SELECT
    c2.c2_filial,
    c2.c2_num,
    c2.c2_item,
    c2.c2_sequen,
    c2.c2_produto,
    c2.c2_local,
    CAST(c2.c2_quant AS numeric) AS qtd_op,
    -- Propagate Pedido from any sequence in the same OP/Item group
    MAX(TRIM(c2.c2_pedido)) OVER (PARTITION BY c2.c2_num, c2.c2_item) AS raw_pedido,
    MAX(TRIM(c2.c2_obs)) OVER (PARTITION BY c2.c2_num, c2.c2_item) AS obs_venda,

    ( c2.c2_num
      || lpad(btrim(c2.c2_item),   2, '0')
      || lpad(btrim(c2.c2_sequen), 3, '0')
    ) AS op_origem

  FROM public.sc2010 c2
  ${whereClause}
  LIMIT 100 -- Limit initial matches to prevent explosion if filter is too broad
),

arvore AS (
  -- nível 0 (raiz)
  SELECT
    ob.c2_filial AS filial,
    ob.c2_num    AS op,
    ob.c2_item   AS item_op,
    ob.c2_sequen AS sequen_op,
    ob.op_origem,
    ob.raw_pedido AS pedido_venda,
    ob.obs_venda,

    0 AS nivel,
    CAST(ob.c2_produto AS text) AS cod_atual,
    NULL::text          AS cod_pai,

    1::numeric          AS fator_rel,
    ob.qtd_op           AS qtd_op,

    CAST(ob.c2_produto AS text) AS caminho,
    ARRAY[CAST(ob.c2_produto AS text)] AS visitados
  FROM op_base ob

  UNION ALL

  -- níveis seguintes (BOM)
  SELECT
    a.filial,
    a.op,
    a.item_op,
    a.sequen_op,
    a.op_origem,
    a.pedido_venda,
    a.obs_venda,

    a.nivel + 1 AS nivel,
    CAST(g1.g1_comp AS text) AS cod_atual,
    CAST(g1.g1_cod AS text)  AS cod_pai,

    a.fator_rel * (CAST(REPLACE(CAST(g1.g1_quant AS text), ',', '.') AS numeric)) AS fator_rel,
    a.qtd_op,

    (a.caminho || ' > ' || g1.g1_comp) AS caminho,
    (a.visitados || CAST(g1.g1_comp AS text))  AS visitados

  FROM arvore a

  -- limita ramificação por pai (evita travar o pgAdmin se tiver BOM enorme)
  JOIN LATERAL (
    SELECT g1.*
    FROM public.sg1010 g1
    WHERE g1.g1_cod = a.cod_atual
      AND g1.d_e_l_e_t_ = ' '
    ORDER BY g1.g1_comp
    LIMIT 200               -- <<< ajuste: 200 filhos por pai (seguro)
  ) g1 ON TRUE

  WHERE
    a.nivel < 25                                  -- <<< limite de níveis
    AND array_length(a.visitados, 1) < 2000       -- <<< trava global “prática”
    AND length(a.caminho) < 4000                  -- <<< evita string gigante
    AND NOT (CAST(g1.g1_comp AS text) = ANY (a.visitados))-- anti-loop (ciclo)
)

SELECT
  a.op_origem,
  a.pedido_venda AS raw_pedido,
  a.obs_venda,
  a.filial,
  a.op,
  a.item_op,
  a.sequen_op,

  a.nivel,

  a.cod_pai       AS codpaiestrutura,
  b_pai.b1_desc   AS descpaiestrutura,

  a.cod_atual     AS codnoarvore,
  b_atual.b1_desc AS descnoarvore,

  a.fator_rel               AS qtdrelativabom,
  (a.fator_rel * a.qtd_op)  AS qtdtotalparaop,

  a.qtd_op                  AS qtd_op_raiz,
  a.caminho
FROM arvore a
LEFT JOIN public.sb1010 b_pai
  ON b_pai.b1_cod = a.cod_pai
 AND b_pai.d_e_l_e_t_ = ' '
LEFT JOIN public.sb1010 b_atual
  ON b_atual.b1_cod = a.cod_atual
 AND b_atual.d_e_l_e_t_ = ' '
ORDER BY
  a.op_origem,
  a.nivel,
  a.caminho
LIMIT 2000;
    `;

    console.log('🔍 [DEBUG] Executing Query:');
    console.log('   Params:', params);
    // console.log('   SQL:', sql); // Uncomment if needed

    const result = await db.query(sql, params);
    console.log(`✅ [DEBUG] Op Query returned ${result.rows.length} rows.`);

    // --- ENRICHMENT DO MYSQL (Verificar documentos) ---
    const rows = result.rows;
    if (rows.length > 0) {
      try {
        // Coletar códigos dos produtos na árvore (codnoarvore)
        // Filtra nulos e remove duplicados para a query
        const codigos = [...new Set(rows.map(r => r.codnoarvore).filter(c => c))];

        if (codigos.length > 0) {
          const placeholders = codigos.map(() => '?').join(',');

          // Busca documentos (trazendo todos para contar e pegar o primeiro)
          const [docsResult] = await mysqlPool.execute(
            `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
            codigos
          );

          // Agrupar por produto
          const docsMap = {};
          docsResult.forEach(d => {
            if (!docsMap[d.produto_codigo]) {
              docsMap[d.produto_codigo] = [];
            }
            docsMap[d.produto_codigo].push(d);
          });

          // Adicionar info aos resultados
          rows.forEach(r => {
            const docs = docsMap[r.codnoarvore] || [];
            r.tem_arquivos = docs.length > 0;
            r.arquivos_count = docs.length;
            r.primeiro_arquivo = docs.length > 0 ? docs[0].url_arquivo : null;
          });
        }
      } catch (mysqlErr) {
        console.error('⚠️ Erro ao verificar documentos no MySQL para OP:', mysqlErr.message);
        // Segue sem travar a request principal
      }
    }

    // Final mapping for fallback
    const enrichedRows = rows.map(r => {
      const p = (r.raw_pedido || '').trim();
      const o = (r.obs_venda || '').trim();
      r.pedido_venda = p || (o.match(/^\d+/)?.[0] || '');
      return r;
    });

    res.json(enrichedRows);
  } catch (err) {
    console.error('Erro ao buscar estrutura por OP:', err);
    res.status(500).json({ error: 'Erro interno ao buscar dados da OP' });
  }
});

// GET /api/producao/vertical-pendencias - Buscar todas as operações pendentes (roteiro completo) baseadas no filtro
router.get('/vertical-pendencias', async (req, res) => {
  try {
    const { op, pedido, produto, cliente, plan_inicio_de, plan_inicio_ate, plan_fim_de, plan_fim_ate } = req.query;

    if (!op && !pedido && !produto && !cliente && !plan_inicio_de && !plan_inicio_ate && !plan_fim_de && !plan_fim_ate) {
      return res.status(400).json({ error: 'É obrigatório informar ao menos um filtro (OP, Pedido, Produto, Cliente ou Período de Planejamento).' });
    }

    console.log(`🏭 [VERTICAL-PENDENCIAS] Buscando roteiro completo com Filtros:`, { op, pedido, produto, cliente, plan_inicio_de, plan_inicio_ate, plan_fim_de, plan_fim_ate });

    let conditions = ["COALESCE(c2.d_e_l_e_t_, '') = ''"];
    let paramsArr = [];
    let pCount = 1;

    // PRE-FILTER BY DATE on MySQL
    let opFilterFromMySQL = null;
    if (plan_inicio_de || plan_inicio_ate || plan_fim_de || plan_fim_ate) {
      let mysqlQuery = `SELECT DISTINCT op_numero FROM app_production_planning WHERE 1=1`;
      let mysqlParams = [];

      if (plan_inicio_de) {
        mysqlQuery += ` AND data_planejada_inicio >= ?`;
        mysqlParams.push(`${plan_inicio_de} 00:00:00`);
      }
      if (plan_inicio_ate) {
        mysqlQuery += ` AND data_planejada_inicio <= ?`;
        mysqlParams.push(`${plan_inicio_ate} 23:59:59`);
      }
      if (plan_fim_de) {
        mysqlQuery += ` AND data_planejada_fim >= ?`;
        mysqlParams.push(`${plan_fim_de} 00:00:00`);
      }
      if (plan_fim_ate) {
        mysqlQuery += ` AND data_planejada_fim <= ?`;
        mysqlParams.push(`${plan_fim_ate} 23:59:59`);
      }

      const [plannedOps] = await mysqlPool.query(mysqlQuery, mysqlParams);
      if (plannedOps.length === 0) {
        return res.json([]); // No OPs planned in this date range at all
      }
      opFilterFromMySQL = plannedOps.map(o => o.op_numero);
    }

    if (opFilterFromMySQL) {
      if (opFilterFromMySQL.length > 5000) {
        opFilterFromMySQL = opFilterFromMySQL.slice(0, 5000);
      }
      const inPlaceholders = opFilterFromMySQL.map((_, i) => `$${pCount + i}`).join(',');
      conditions.push(`TRIM(c2.c2_num) IN (${inPlaceholders})`);
      paramsArr.push(...opFilterFromMySQL);
      pCount += opFilterFromMySQL.length;
    }

    if (op) {
      conditions.push(`TRIM(c2.c2_num) ILIKE $${pCount++}`);
      paramsArr.push(`%${op.trim()}%`);
    }
    if (pedido) {
      conditions.push(`(TRIM(c2.c2_pedido) ILIKE $${pCount} OR TRIM(c2.c2_obs) ILIKE $${pCount})`);
      paramsArr.push(`%${pedido.trim()}%`);
      pCount++;
    }
    if (produto) {
      conditions.push(`(TRIM(c2.c2_produto) ILIKE $${pCount} OR TRIM(b1.b1_desc) ILIKE $${pCount})`);
      paramsArr.push(`%${produto.trim()}%`);
      pCount++;
    }
    if (cliente) {
      conditions.push(`(TRIM(c6.c6_cli) ILIKE $${pCount} OR TRIM(a1.a1_nome) ILIKE $${pCount})`);
      paramsArr.push(`%${cliente.trim()}%`);
      pCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query Protheus sem restrição de g2_recurso
    const pgQuery = `
      SELECT
        TRIM(c2.c2_num) AS op,
        TRIM(c2.c2_item) AS item_op,
        TRIM(c2.c2_sequen) AS sequen_op,
        TRIM(c2.c2_produto) AS produto,
        TRIM(c2.c2_pedido) AS raw_pedido,
        TRIM(c2.c2_obs) AS obs_venda,
        TRIM(c2.c2_itempv) AS item_pedido,
        c2.c2_quant::numeric AS qtd_op,
        COALESCE(TRIM(c6.c6_descri), TRIM(b1.b1_desc)) AS desc_produto,
        TRIM(g2.g2_operac) AS operacao_codigo,
        TRIM(h1.h1_descri) AS operacao_desc,
        TRIM(g2.g2_recurso) AS recurso_codigo
      FROM public.sc2010 c2
      INNER JOIN public.sg2010 g2
        ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sh1010 h1
        ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
      LEFT JOIN public.sc6010 c6
        ON TRIM(c6.c6_num) = TRIM(c2.c2_pedido) AND TRIM(c6.c6_item) = TRIM(c2.c2_itempv) AND COALESCE(c6.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sa1010 a1
        ON TRIM(a1.a1_cod) = TRIM(c6.c6_cli) AND TRIM(a1.a1_loja) = TRIM(c6.c6_loja) AND COALESCE(a1.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto) AND COALESCE(b1.d_e_l_e_t_, '') = ''
      ${whereClause}
      ORDER BY c2.c2_pedido ASC, c2.c2_num ASC, g2.g2_operac ASC
    `;

    const pgResult = await db.query(pgQuery, paramsArr);
    const opsList = pgResult.rows;

    if (opsList.length === 0) {
      return res.json([]);
    }

    // Enrichment via MySQL Appointments
    const opCodes = [...new Set(opsList.map(o => o.op))];
    const opCodOperacoes = [...new Set(opsList.map(o => o.operacao_codigo).filter(Boolean))];
    const opPlaceholders = opCodes.map(() => '?').join(',');
    const opOperacPlaceholders = opCodOperacoes.map(() => '?').join(',');

    let appointments = [];
    if (opCodes.length > 0 && opCodOperacoes.length > 0) {
      const [aRows] = await mysqlPool.query(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo,
               SUM(quantidade) as total_produzido
        FROM app_production_appointments
        WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
        GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
      `, [...opCodes, ...opCodOperacoes]);
      appointments = aRows;
    }

    // Precisamos de plans para filtrar pendências pelas datas planejadas também
    let plans = [];
    if (opCodes.length > 0 && opCodOperacoes.length > 0) {
      const [pRows] = await mysqlPool.query(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo,
               data_planejada_inicio, data_planejada_fim
        FROM app_production_planning
        WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
      `, [...opCodes, ...opCodOperacoes]);
      plans = pRows;
    }

    // Merge e filtro local (apenas pendentes)
    const pendingList = opsList.map(opRow => {
      const a = appointments.find(appt =>
        appt.op_numero === opRow.op &&
        appt.op_item === opRow.item_op &&
        appt.op_sequencia === opRow.sequen_op &&
        appt.operacao_codigo === opRow.operacao_codigo
      );

      const qtd_planejada = parseFloat(opRow.qtd_op) || 0;
      const qtd_apontada = a ? (parseFloat(a.total_produzido) || 0) : 0;

      let status = 'PENDENTE';
      if (qtd_apontada >= qtd_planejada && qtd_planejada > 0) {
        status = 'CONCLUIDO';
      } else if (qtd_apontada > 0) {
        status = 'PARCIAL';
      }

      const p = plans.find(plan =>
        plan.op_numero === opRow.op &&
        plan.op_item === opRow.item_op &&
        plan.op_sequencia === opRow.sequen_op &&
        plan.operacao_codigo === opRow.operacao_codigo
      );

      return {
        ...opRow,
        pedido: (opRow.raw_pedido || '').trim() || (opRow.obs_venda || '').trim().match(/^\d+/)?.[0] || '',
        qtd_apontada,
        status,
        planejamento_inicio: p ? p.data_planejada_inicio : null,
        planejamento_fim: p ? p.data_planejada_fim : null
      };
    }).filter(item => item.status !== 'CONCLUIDO'); // Mantém PENDENTE e PARCIAL

    let finalList = pendingList;
    if (plan_inicio_de) {
      finalList = finalList.filter(r => r.planejamento_inicio && r.planejamento_inicio >= `${plan_inicio_de} 00:00:00`);
    }
    if (plan_inicio_ate) {
      finalList = finalList.filter(r => r.planejamento_inicio && r.planejamento_inicio <= `${plan_inicio_ate} 23:59:59`);
    }
    if (plan_fim_de) {
      finalList = finalList.filter(r => r.planejamento_fim && r.planejamento_fim >= `${plan_fim_de} 00:00:00`);
    }
    if (plan_fim_ate) {
      finalList = finalList.filter(r => r.planejamento_fim && r.planejamento_fim <= `${plan_fim_ate} 23:59:59`);
    }

    res.json(finalList);
  } catch (err) {
    console.error('Erro na rota vertical-pendencias:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/producao/vertical/:operacao - Buscar fila de produção por Recurso (máquina/setor)
router.get('/vertical/:operacao', async (req, res) => {
  try {
    let { operacao } = req.params;
    operacao = String(operacao).trim(); // Mantém o código do recurso como veio (ex: 'MO0004')
    const { op, pedido, produto, cliente, plan_inicio_de, plan_inicio_ate, plan_fim_de, plan_fim_ate } = req.query;

    console.log(`🏭 [VERTICAL] Buscando fila para recurso: ${operacao} com Filtros`, { op, pedido, produto, cliente, plan_inicio_de, plan_inicio_ate, plan_fim_de, plan_fim_ate });

    let conditions = ["COALESCE(c2.d_e_l_e_t_, '') = ''", "TRIM(g2.g2_recurso) = $1"];
    let paramsArr = [operacao];
    let pCount = 2;

    // PRE-FILTER BY DATE on MySQL
    let opFilterFromMySQL = null;
    if (plan_inicio_de || plan_inicio_ate || plan_fim_de || plan_fim_ate) {
      let mysqlQuery = `SELECT DISTINCT op_numero FROM app_production_planning WHERE 1=1`;
      let mysqlParams = [];

      if (plan_inicio_de) {
        mysqlQuery += ` AND data_planejada_inicio >= ?`;
        mysqlParams.push(`${plan_inicio_de} 00:00:00`);
      }
      if (plan_inicio_ate) {
        mysqlQuery += ` AND data_planejada_inicio <= ?`;
        mysqlParams.push(`${plan_inicio_ate} 23:59:59`);
      }
      if (plan_fim_de) {
        mysqlQuery += ` AND data_planejada_fim >= ?`;
        mysqlParams.push(`${plan_fim_de} 00:00:00`);
      }
      if (plan_fim_ate) {
        mysqlQuery += ` AND data_planejada_fim <= ?`;
        mysqlParams.push(`${plan_fim_ate} 23:59:59`);
      }

      const [plannedOps] = await mysqlPool.query(mysqlQuery, mysqlParams);
      if (plannedOps.length === 0) {
        return res.json([]); // No OPs planned in this date range at all
      }
      opFilterFromMySQL = plannedOps.map(o => o.op_numero);
    }

    if (opFilterFromMySQL) {
      if (opFilterFromMySQL.length > 5000) {
        opFilterFromMySQL = opFilterFromMySQL.slice(0, 5000);
      }
      const inPlaceholders = opFilterFromMySQL.map((_, i) => `$${pCount + i}`).join(',');
      conditions.push(`TRIM(c2.c2_num) IN (${inPlaceholders})`);
      paramsArr.push(...opFilterFromMySQL);
      pCount += opFilterFromMySQL.length;
    }

    if (op) {
      conditions.push(`TRIM(c2.c2_num) ILIKE $${pCount++}`);
      paramsArr.push(`%${op.trim()}%`);
    }
    if (pedido) {
      conditions.push(`(TRIM(c2.c2_pedido) ILIKE $${pCount} OR TRIM(c2.c2_obs) ILIKE $${pCount})`);
      paramsArr.push(`%${pedido.trim()}%`);
      pCount++;
    }
    if (produto) {
      conditions.push(`(TRIM(c2.c2_produto) ILIKE $${pCount} OR TRIM(b1.b1_desc) ILIKE $${pCount})`);
      paramsArr.push(`%${produto.trim()}%`);
      pCount++;
    }
    if (cliente) {
      conditions.push(`(TRIM(c6.c6_cli) ILIKE $${pCount} OR TRIM(a1.a1_nome) ILIKE $${pCount})`);
      paramsArr.push(`%${cliente.trim()}%`);
      pCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query Protheus: Busca todas as OPs ativas que passam por este RECURSO (g2_recurso)
    // O dropdown é populado com recursos (SH1010 → MO0004), por isso filtramos por g2_recurso,
    // não por g2_operac (que é o código numérico da operação).
    const pgQuery = `
      SELECT
        TRIM(c2.c2_num) AS op,
        TRIM(c2.c2_item) AS item_op,
        TRIM(c2.c2_sequen) AS sequen_op,
        TRIM(c2.c2_produto) AS produto,
        TRIM(c2.c2_pedido) AS raw_pedido,
        TRIM(c2.c2_obs) AS obs_venda,
        TRIM(c2.c2_itempv) AS item_pedido,
        c2.c2_quant::numeric AS qtd_op,
        COALESCE(TRIM(c6.c6_descri), TRIM(b1.b1_desc)) AS desc_produto,
        CASE
          WHEN c6.c6_entreg IS NOT NULL AND c6.c6_entreg <> ''
          THEN TO_CHAR(TO_DATE(c6.c6_entreg, 'YYYYMMDD'), 'YYYY-MM-DD')
          ELSE NULL
        END AS data_entrega,
        TRIM(g2.g2_operac) AS operacao_codigo,
        TRIM(h1.h1_descri) AS operacao_desc,
        TRIM(g2.g2_recurso) AS recurso_codigo
      FROM public.sc2010 c2
      INNER JOIN public.sg2010 g2
        ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sh1010 h1
        ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
      LEFT JOIN public.sc6010 c6
        ON TRIM(c6.c6_num) = TRIM(c2.c2_pedido) AND TRIM(c6.c6_item) = TRIM(c2.c2_itempv) AND COALESCE(c6.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sa1010 a1
        ON TRIM(a1.a1_cod) = TRIM(c6.c6_cli) AND TRIM(a1.a1_loja) = TRIM(c6.c6_loja) AND COALESCE(a1.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto) AND COALESCE(b1.d_e_l_e_t_, '') = ''
      ${whereClause}
      ORDER BY c6.c6_entreg ASC NULLS LAST, c2.c2_pedido ASC, c2.c2_num ASC
    `;

    const pgResult = await db.query(pgQuery, paramsArr);
    const opsList = pgResult.rows;

    console.log(`📋 [VERTICAL] Encontradas ${opsList.length} OPs na estrutura para a operação ${operacao}.`);

    if (opsList.length === 0) {
      return res.json([]);
    }

    // 2. Enrichment com Planejamento e Apontamentos do MySQL
    // Usamos os códigos reais de OP e de operação presentes nas linhas retornadas
    const opCodes = [...new Set(opsList.map(o => o.op))];
    const opCodOperacoes = [...new Set(opsList.map(o => o.operacao_codigo).filter(Boolean))];
    const opPlaceholders = opCodes.map(() => '?').join(',');
    const opOperacPlaceholders = opCodOperacoes.map(() => '?').join(',');

    let plans = [];
    let appointments = [];

    if (opCodes.length > 0 && opCodOperacoes.length > 0) {
      // Buscar Planejamentos para todas as OPs + operações presentes no resultado
      const [pRows] = await mysqlPool.query(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo,
               data_planejada_inicio, data_planejada_fim
        FROM app_production_planning
        WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
      `, [...opCodes, ...opCodOperacoes]);
      plans = pRows;

      // Buscar Apontamentos para todas as OPs + operações presentes no resultado
      const [aRows] = await mysqlPool.query(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo,
               SUM(quantidade) as total_produzido,
               MIN(data_inicio) as primeira_data,
               MAX(data_fim) as ultima_data,
               GROUP_CONCAT(DISTINCT usuario SEPARATOR ', ') as usuarios
        FROM app_production_appointments
        WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
        GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
      `, [...opCodes, ...opCodOperacoes]);
      appointments = aRows;
    }

    // 2.5 Verificar documentos de produto (PDF) no MySQL
    const codigosProdutos = [...new Set(opsList.map(o => o.produto).filter(Boolean))];
    const docsMap = {};
    if (codigosProdutos.length > 0) {
      try {
        const prodPlaceholders = codigosProdutos.map(() => '?').join(',');
        const [docsResult] = await mysqlPool.query(
          `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${prodPlaceholders})`,
          codigosProdutos
        );
        docsResult.forEach(d => {
          if (!docsMap[d.produto_codigo]) docsMap[d.produto_codigo] = [];
          docsMap[d.produto_codigo].push(d);
        });
      } catch (err) {
        console.error('⚠️ [VERTICAL] Erro ao buscar arquivos PDF:', err.message);
      }
    }

    // 3. Mesclar os dados
    const enrichedList = opsList.map(opRow => {
      const p = plans.find(plan =>
        plan.op_numero === opRow.op &&
        plan.op_item === opRow.item_op &&
        plan.op_sequencia === opRow.sequen_op &&
        plan.operacao_codigo === opRow.operacao_codigo
      );

      const a = appointments.find(appt =>
        appt.op_numero === opRow.op &&
        appt.op_item === opRow.item_op &&
        appt.op_sequencia === opRow.sequen_op &&
        appt.operacao_codigo === opRow.operacao_codigo
      );

      const qtd_planejada = parseFloat(opRow.qtd_op) || 0;
      const qtd_apontada = a ? (parseFloat(a.total_produzido) || 0) : 0;

      let status = 'PENDENTE';
      if (qtd_apontada >= qtd_planejada && qtd_planejada > 0) {
        status = 'CONCLUIDO';
      } else if (qtd_apontada > 0) {
        status = 'PARCIAL';
      }

      const docs = docsMap[opRow.produto] || [];
      const tem_arquivos = docs.length > 0;
      const primeiro_arquivo = docs.length > 0 ? docs[0].url_arquivo : null;

      const rawP = (opRow.raw_pedido || '').trim();
      const rawO = (opRow.obs_venda || '').trim();

      return {
        ...opRow,
        status,
        pedido: rawP || (rawO.match(/^\d+/)?.[0] || ''),
        planejamento_inicio: p ? p.data_planejada_inicio : null,
        planejamento_fim: p ? p.data_planejada_fim : null,
        qtd_apontada: qtd_apontada,
        usuarios_apontamento: a ? a.usuarios : null,
        ultima_data_apontamento: a ? a.ultima_data : null,
        tem_arquivos,
        primeiro_arquivo
      };
    });

    let finalList = enrichedList;
    if (plan_inicio_de) {
      finalList = finalList.filter(r => r.planejamento_inicio && r.planejamento_inicio >= `${plan_inicio_de} 00:00:00`);
    }
    if (plan_inicio_ate) {
      finalList = finalList.filter(r => r.planejamento_inicio && r.planejamento_inicio <= `${plan_inicio_ate} 23:59:59`);
    }
    if (plan_fim_de) {
      finalList = finalList.filter(r => r.planejamento_fim && r.planejamento_fim >= `${plan_fim_de} 00:00:00`);
    }
    if (plan_fim_ate) {
      finalList = finalList.filter(r => r.planejamento_fim && r.planejamento_fim <= `${plan_fim_ate} 23:59:59`);
    }

    res.json(finalList);

  } catch (err) {
    console.error('❌ [VERTICAL ROUTE ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/producao/search-ops
// Busca lista de OPs com filtros dinâmicos para o seletor
// ============================================================
router.get('/search-ops', async (req, res) => {
  try {
    const { op, cliente, produto, prazo_de, prazo_ate, limit: lim = 50 } = req.query;

    if (!op && !cliente && !produto && !prazo_de && !prazo_ate) {
      return res.status(400).json({ error: 'Informe ao menos um filtro.' });
    }

    const params = [];
    let pCount = 1;
    let conditions = ["COALESCE(c2.d_e_l_e_t_, '') = ''"];

    if (op) {
      conditions.push(`TRIM(c2.c2_num) ILIKE $${pCount++}`);
      params.push(`%${op.trim()}%`);
    }
    if (produto) {
      conditions.push(`(TRIM(c2.c2_produto) ILIKE $${pCount} OR TRIM(b1.b1_desc) ILIKE $${pCount})`);
      params.push(`%${produto.trim()}%`);
      pCount++;
    }
    if (cliente) {
      conditions.push(`TRIM(a1.a1_nome) ILIKE $${pCount++}`);
      params.push(`%${cliente.trim()}%`);
    }
    if (prazo_de) {
      conditions.push(`TRIM(c2.c2_datprf) >= $${pCount++}`);
      params.push(prazo_de.replace(/-/g, ''));
    }
    if (prazo_ate) {
      conditions.push(`TRIM(c2.c2_datprf) <= $${pCount++}`);
      params.push(prazo_ate.replace(/-/g, ''));
    }

    const whereSQL = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT
        TRIM(c2.c2_num)                                      AS op,
        TRIM(c2.c2_produto)                                  AS produto,
        TRIM(COALESCE(b1.b1_desc, ''))                       AS descricao,
        c2.c2_quant::numeric                                 AS qtd_op,
        TRIM(c2.c2_datprf)                                   AS prazo_raw,
        TRIM(COALESCE(c2.c2_pedido, ''))                     AS pedido_venda,
        TRIM(COALESCE(a1.a1_nome, ''))                       AS cliente
      FROM public.sc2010 c2
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto)
       AND COALESCE(b1.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sc5010 c5
        ON TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
       AND COALESCE(c5.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sa1010 a1
        ON a1.a1_cod  = c5.c5_cliente
       AND a1.a1_loja = c5.c5_lojacli
       AND COALESCE(a1.d_e_l_e_t_, '') = ''
      ${whereSQL}
      ORDER BY c2.c2_datprf DESC, c2.c2_num ASC
      LIMIT $${pCount}
    `;
    params.push(parseInt(lim, 10) || 50);

    const result = await db.query(sql, params);

    // Converter prazo_raw (YYYYMMDD) → ISO date
    const rows = result.rows.map(r => {
      const raw = (r.prazo_raw || '').replace(/\s/g, '');
      let prazo = null;
      if (raw.length === 8) {
        prazo = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      }
      return { ...r, prazo };
    });

    res.json(rows);
  } catch (err) {
    console.error('❌ [SEARCH-OPS]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/producao/estrutura-routing
// Retorna estrutura BOM + Roteiro de uma OP em JSON aninhado
// ============================================================
router.get('/estrutura-routing', async (req, res) => {
  try {
    const { op } = req.query;
    if (!op) return res.status(400).json({ error: 'Parâmetro "op" é obrigatório.' });

    const opTrim = op.trim();

    // 1. Cabeçalho da OP + produtos (conjuntos pai)
    const headerSQL = `
      SELECT
        TRIM(c2.c2_num)                          AS op,
        TRIM(c2.c2_item)                         AS item_op,
        TRIM(c2.c2_sequen)                       AS sequen_op,
        TRIM(c2.c2_produto)                      AS produto,
        TRIM(COALESCE(b1.b1_desc, ''))           AS descricao,
        c2.c2_quant::numeric                     AS qtd_produzir,
        TRIM(c2.c2_datprf)                       AS prazo_raw,
        TRIM(COALESCE(c2.c2_pedido, ''))         AS pedido_venda,
        TRIM(COALESCE(a1.a1_nome, ''))           AS cliente
      FROM public.sc2010 c2
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto)
       AND COALESCE(b1.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sc5010 c5
        ON TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
       AND COALESCE(c5.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sa1010 a1
        ON a1.a1_cod  = c5.c5_cliente
       AND a1.a1_loja = c5.c5_lojacli
       AND COALESCE(a1.d_e_l_e_t_, '') = ''
      WHERE COALESCE(c2.d_e_l_e_t_, '') = ''
        AND TRIM(c2.c2_num) = $1
      ORDER BY c2.c2_item, c2.c2_sequen
    `;
    const headerResult = await db.query(headerSQL, [opTrim]);
    if (headerResult.rows.length === 0) {
      return res.status(404).json({ error: `OP "${opTrim}" não encontrada.` });
    }

    const firstRow = headerResult.rows[0];
    const paiCodes = [...new Set(headerResult.rows.map(r => r.produto).filter(Boolean))];

    // Converter prazo
    const prazoRaw = (firstRow.prazo_raw || '').replace(/\s/g, '');
    const prazo = prazoRaw.length === 8
      ? `${prazoRaw.slice(0, 4)}-${prazoRaw.slice(4, 6)}-${prazoRaw.slice(6, 8)}`
      : null;

    // 2. BOM (1 nível: filhos diretos dos pais)
    const bomSQL = `
      SELECT
        TRIM(g1.g1_cod)               AS produto_pai,
        TRIM(g1.g1_comp)              AS componente,
        TRIM(COALESCE(b1.b1_desc, '')) AS desc_componente,
        TRIM(COALESCE(b1.b1_tipo, '')) AS tipo_componente,
        g1.g1_quant::numeric          AS qtd_por_pai
      FROM public.sg1010 g1
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp)
       AND COALESCE(b1.d_e_l_e_t_, '') = ''
      WHERE COALESCE(g1.d_e_l_e_t_, '') = ''
        AND TRIM(g1.g1_cod) = ANY($1)
      ORDER BY g1.g1_cod, g1.g1_comp
    `;
    const bomResult = await db.query(bomSQL, [paiCodes]);
    const filhoCodes = [...new Set(bomResult.rows.map(r => r.componente).filter(Boolean))];

    // 3. Roteiro (SG2 + SH1) para todos os produtos: pai + filhos
    const allCodes = [...new Set([...paiCodes, ...filhoCodes])];
    let roteiroPorProduto = {};
    if (allCodes.length > 0) {
      const roteiroSQL = `
        SELECT
          TRIM(g2.g2_produto)                          AS produto,
          TRIM(g2.g2_codigo)                           AS seq_codigo,
          TRIM(COALESCE(h1.h1_descri, g2.g2_recurso)) AS recurso,
          TRIM(COALESCE(g2.g2_operac, ''))             AS operacao_cod,
          0            AS tempo,
          0            AS setup
        FROM public.sg2010 g2
        LEFT JOIN public.sh1010 h1
          ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
         AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
        WHERE COALESCE(g2.d_e_l_e_t_, '') = ''
          AND TRIM(g2.g2_produto) = ANY($1)
        ORDER BY g2.g2_produto, g2.g2_codigo
      `;
      const roteiroResult = await db.query(roteiroSQL, [allCodes]);
      for (const r of roteiroResult.rows) {
        if (!roteiroPorProduto[r.produto]) roteiroPorProduto[r.produto] = [];
        roteiroPorProduto[r.produto].push({
          seq: parseInt(r.seq_codigo, 10) || 0,
          recurso: r.recurso || r.operacao_cod || 'N/D',
          desc: r.operacao_cod || ''
        });
      }
    }

    // 4. Montar BOM por pai
    const bomPorPai = {};
    for (const b of bomResult.rows) {
      if (!bomPorPai[b.produto_pai]) bomPorPai[b.produto_pai] = [];
      bomPorPai[b.produto_pai].push(b);
    }

    // 5. Construir JSON aninhado
    const conjuntos = headerResult.rows.map((p, idx) => ({
      id: `PAI-${idx}-${p.item_op}-${p.sequen_op}`,
      codigo: p.produto,
      descricao: p.descricao,
      tipo: 'PAI',
      qtd_produzir: parseFloat(p.qtd_produzir) || 0,
      item_op: p.item_op,
      sequen_op: p.sequen_op,
      operacoes: (roteiroPorProduto[p.produto] || []),
      filhos: (bomPorPai[p.produto] || []).map((filho, fidx) => ({
        id: `FILHO-${idx}-${fidx}-${filho.componente}`,
        codigo: filho.componente,
        descricao: filho.desc_componente,
        tipo: 'FILHO',
        tipo_componente: filho.tipo_componente,
        qtd_por_pai: parseFloat(filho.qtd_por_pai) || 0,
        operacoes: (roteiroPorProduto[filho.componente] || [])
      }))
    }));

    res.json({
      op: opTrim,
      cliente: firstRow.cliente,
      prazo,
      pedido_venda: firstRow.pedido_venda,
      conjuntos
    });
  } catch (err) {
    console.error('❌ [ESTRUTURA-ROUTING]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
