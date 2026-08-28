const express = require('express');
const router = express.Router();
console.log('🔄 [DEBUG] Carregando arquivo routes/producao.js');
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

// --- INITIALIZE CHECKLIST TABLES ---
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_montagem_checklist (
                idChecklist INT AUTO_INCREMENT PRIMARY KEY,
                op VARCHAR(50) NOT NULL,
                item_op VARCHAR(10) NOT NULL,
                sequen_op VARCHAR(10) NOT NULL,
                produto_pai VARCHAR(50) NOT NULL,
                idUsuario INT NOT NULL,
                real_datetime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                data_finalizado DATETIME DEFAULT NULL,
                qtd_conjuntos INT NOT NULL DEFAULT 1,
                observacao_geral TEXT,
                status ENUM('RASCUNHO', 'FINALIZADO') DEFAULT 'RASCUNHO',
                INDEX idx_op_item (op, item_op, sequen_op)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_montagem_checklist_itens (
                idChecklistItem INT AUTO_INCREMENT PRIMARY KEY,
                idChecklist INT NOT NULL,
                codigo_componente VARCHAR(50) NOT NULL,
                descricao_componente VARCHAR(255),
                montado TINYINT(1) DEFAULT 0,
                observacao TEXT,
                foto_url VARCHAR(255),
                FOREIGN KEY (idChecklist) REFERENCES app_montagem_checklist(idChecklist) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ [CHECKLIST] Tabelas verificadas/criadas com sucesso no MySQL.');
    } catch (err) {
        console.error('❌ [CHECKLIST] Erro ao inicializar tabelas:', err.message);
    }
})();

// POST /api/producao/pg-cleanup — libera conexões idle no PostgreSQL
// Usa a conexão do pool existente para encerrar sessões ociosas > 3 min
router.post('/pg-cleanup', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pg_terminate_backend(pid) as terminated, pid, usename, state,
             now() - state_change AS idle_since
      FROM pg_stat_activity
      WHERE state = 'idle'
        AND now() - state_change > interval '3 minutes'
        AND pid <> pg_backend_pid()
    `);
    const terminated = result.rows.filter(r => r.terminated).length;
    console.log(`🧹 [PG-CLEANUP] Encerradas ${terminated} sessões idle de ${result.rows.length} candidatas`);
    res.json({ terminated, candidates: result.rows.length, message: `${terminated} conexões idle encerradas` });
  } catch (err) {
    console.error('❌ [PG-CLEANUP] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/producao/ordens
router.get('/ordens', async (req, res) => {
  try {
    const { pedido } = req.query;

    if (!pedido || pedido.trim() === '') {
      return res.json([]);
    }

    let queryParams = [];
    let filterClause = '';

    queryParams.push(pedido.trim());
    filterClause = `AND c5.c5_num = $${queryParams.length}`;

    // Resolve filtro de pedidos inativos ANTES do template
    const getInactiveFilter = await getInactiveOrdersFilter();
    const inactiveFilterOrdens = getInactiveFilter('c5.c5_num');

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
    ${inactiveFilterOrdens}
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
  WHERE a.nivel < 12
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

    // Resolve filtro de pedidos inativos ANTES de montar whereClause
    const getInactiveFilterOp = await getInactiveOrdersFilter();
    const inactiveFilterOp = getInactiveFilterOp('c5.c5_num');

    // Dynamic Parameter Building
    const params = [];
    let paramCount = 1;

    let whereClause = "WHERE c2.d_e_l_e_t_ = ' ' ";

    if (op) {
      const formattedOp = String(op).trim().padStart(6, '0');
      params.push(formattedOp);
      whereClause += `AND (TRIM(c2.c2_num) = $${paramCount} OR TRIM(c2.c2_pedido) = $${paramCount} OR TRIM(c2.c2_obs) LIKE '%' || $${paramCount} || '%') `;
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
                ${inactiveFilterOp}
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

    const getInactiveFilter = await getInactiveOrdersFilter();
    let conditions = ["COALESCE(c2.d_e_l_e_t_, '') = ''"];
    const inactiveSql = getInactiveFilter(`COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),''))`);
    if (inactiveSql) conditions.push(inactiveSql.replace(/^\s*AND\s+/i, ''));
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
      opFilterFromMySQL = plannedOps.map(o => String(o.op_numero).trim().padStart(6, '0'));
    }

    if (opFilterFromMySQL) {
      if (opFilterFromMySQL.length > 5000) {
        opFilterFromMySQL = opFilterFromMySQL.slice(0, 5000);
      }
      const inPlaceholders = opFilterFromMySQL.map((_, i) => `$${pCount + i}`).join(',');
      conditions.push(`c2.c2_num IN (${inPlaceholders})`);
      paramsArr.push(...opFilterFromMySQL);
      pCount += opFilterFromMySQL.length;
    }

    if (op) {
      conditions.push(`c2.c2_num = $${pCount++}`);
      paramsArr.push(String(op).trim().padStart(6, '0'));
    }
    if (pedido) {
      const pedidoList = String(pedido).split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => p.padStart(6, '0'));

      if (pedidoList.length === 1) {
        conditions.push(`(c2.c2_pedido = $${pCount} OR root_op.c2_pedido = $${pCount})`);
        paramsArr.push(pedidoList[0]);
        pCount++;
      } else if (pedidoList.length > 1) {
        const placeholders = pedidoList.map((_, i) => `$${pCount + i}`).join(', ');
        conditions.push(`(c2.c2_pedido IN (${placeholders}) OR root_op.c2_pedido IN (${placeholders}))`);
        paramsArr.push(...pedidoList);
        pCount += pedidoList.length;
      }
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
        COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) AS raw_pedido,
        COALESCE(NULLIF(TRIM(c2.c2_obs),''), NULLIF(TRIM(root_op.c2_obs),'')) AS obs_venda,
        COALESCE(NULLIF(TRIM(c2.c2_itempv),''), NULLIF(TRIM(root_op.c2_itempv),'')) AS item_pedido,
        c2.c2_quant::numeric AS qtd_op,
        COALESCE(TRIM(c6.c6_descri), TRIM(b1.b1_desc)) AS desc_produto,
        TRIM(g2.g2_operac) AS operacao_codigo,
        TRIM(h1.h1_descri) AS operacao_desc,
        TRIM(g2.g2_recurso) AS recurso_codigo
      FROM public.sc2010 c2
      LEFT JOIN public.sc2010 root_op
        ON  root_op.c2_num    = c2.c2_num
        AND root_op.c2_item   = c2.c2_item
        AND root_op.c2_sequen = '001'
        AND COALESCE(root_op.d_e_l_e_t_, '') = ''
      INNER JOIN public.sg2010 g2
        ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sh1010 h1
        ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
      LEFT JOIN public.sc6010 c6
        ON TRIM(c6.c6_num) = COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) 
       AND TRIM(c6.c6_item) = COALESCE(NULLIF(TRIM(c2.c2_itempv),''), NULLIF(TRIM(root_op.c2_itempv),'')) 
       AND COALESCE(c6.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sa1010 a1
        ON TRIM(a1.a1_cod) = TRIM(c6.c6_cli) AND TRIM(a1.a1_loja) = TRIM(c6.c6_loja) AND COALESCE(a1.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto) AND COALESCE(b1.d_e_l_e_t_, '') = ''
      ${whereClause}
      ORDER BY COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) ASC, c2.c2_num ASC, g2.g2_operac ASC
    `;

    const pendenciasClient = await db.connect();
    let pgResult;
    try {
      await pendenciasClient.query('SET statement_timeout = 120000');
      pgResult = await pendenciasClient.query(pgQuery, paramsArr);
    } finally {
      pendenciasClient.release();
    }
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
        AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
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
      finalList = finalList.filter(r => r.planejamento_inicio && new Date(r.planejamento_inicio) >= new Date(`${String(plan_inicio_de)}T00:00:00`));
    }
    if (plan_inicio_ate) {
      finalList = finalList.filter(r => !r.planejamento_inicio || new Date(r.planejamento_inicio) <= new Date(`${String(plan_inicio_ate)}T23:59:59`));
    }
    if (plan_fim_de) {
      finalList = finalList.filter(r => r.planejamento_fim && new Date(r.planejamento_fim) >= new Date(`${String(plan_fim_de)}T00:00:00`));
    }
    if (plan_fim_ate) {
      finalList = finalList.filter(r => r.planejamento_fim && new Date(r.planejamento_fim) <= new Date(`${String(plan_fim_ate)}T23:59:59`));
    }

    res.json(finalList);
  } catch (err) {
    console.error('❌ [VERTICAL-PENDENCIAS ERROR] message:', err.message);
    console.error('❌ [VERTICAL-PENDENCIAS ERROR] code:', err.code);
    console.error('❌ [VERTICAL-PENDENCIAS ERROR] detail:', err.detail);
    console.error('❌ [VERTICAL-PENDENCIAS ERROR] stack:', err.stack);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// GET /api/producao/vertical/:operacao - Buscar fila de produção por Recurso (máquina/setor)
router.get('/vertical/:operacao', async (req, res) => {
  try {
    let { operacao } = req.params;
    operacao = String(operacao).split('-')[0].trim();
    const { op, pedido, produto, cliente, plan_inicio_de, plan_inicio_ate, plan_fim_de, plan_fim_ate, status, sort_key, sort_dir } = req.query;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(   parseInt(req.query.limit) || 200, 1000);
    const offset = (page - 1) * limit;

    console.log(`🏭 [VERTICAL] ${operacao} | page=${page} limit=${limit}`, { op, pedido, produto, cliente, plan_inicio_de, plan_inicio_ate });

    const getInactiveFilter = await getInactiveOrdersFilter();

    // PRE-FILTER BY DATE: get OP list from MySQL planning table
    let opFilterFromMySQL = null;
    if (plan_inicio_de || plan_inicio_ate || plan_fim_de || plan_fim_ate) {
      let mysqlQuery = `SELECT DISTINCT op_numero FROM app_production_planning WHERE recurso_codigo = ?`;
      const mysqlParams = [operacao];
      if (plan_inicio_de) { mysqlQuery += ` AND data_planejada_inicio >= ?`; mysqlParams.push(`${plan_inicio_de} 00:00:00`); }
      if (plan_inicio_ate) { mysqlQuery += ` AND data_planejada_inicio <= ?`; mysqlParams.push(`${plan_inicio_ate} 23:59:59`); }
      if (plan_fim_de)    { mysqlQuery += ` AND data_planejada_fim >= ?`;    mysqlParams.push(`${plan_fim_de} 00:00:00`); }
      if (plan_fim_ate)   { mysqlQuery += ` AND data_planejada_fim <= ?`;    mysqlParams.push(`${plan_fim_ate} 23:59:59`); }
      const [plannedOps] = await mysqlPool.query(mysqlQuery, mysqlParams);
      if (plannedOps.length === 0) {
        // Nenhum planejamento no período para este recurso — não bloquear.
        // Exibe todas as OPs do Protheus sem restrição de data local.
        console.log(`ℹ️ [VERTICAL] Sem dados em app_production_planning para ${operacao} no período. Exibindo todas as OPs do Protheus.`);
        opFilterFromMySQL = null;
      } else {
        opFilterFromMySQL = plannedOps.map(o => String(o.op_numero).trim().padStart(6, '0')).slice(0, 5000);
      }
    }

    // ETAPA 1: routing map (for enrichment and BOM lookup)
    const sgResult = await db.query(`
      SELECT TRIM(g2.g2_produto) AS produto, TRIM(g2.g2_operac) AS operacao_codigo,
             TRIM(g2.g2_recurso) AS recurso_codigo, TRIM(h1.h1_descri) AS operacao_desc
      FROM public.sg2010 g2
      LEFT JOIN public.sh1010 h1
        ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
      WHERE TRIM(g2.g2_recurso) = $1 AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
    `, [operacao]);

    if (sgResult.rows.length === 0) {
      console.log(`⚠️ [VERTICAL] Nenhum produto no roteiro para ${operacao}`);
      return res.json({ data: [], pagination: { page, limit, hasMore: false, total: 0 } });
    }

    const routingMap = {};
    const produtosDoRecurso = [];
    sgResult.rows.forEach(r => {
      if (!routingMap[r.produto]) { routingMap[r.produto] = []; produtosDoRecurso.push(r.produto); }
      routingMap[r.produto].push(r);
    });
    console.log(`📋 [VERTICAL] ${operacao} → ${produtosDoRecurso.length} produtos no roteiro`);

    // ETAPA 2: build WHERE conditions
    // Use INNER JOIN with sg2010 instead of ANY(huge_array) — avoids 13k-item parameter arrays
    let sc2Conditions = [`COALESCE(c2.d_e_l_e_t_, '') = ''`];
    let sc2Params = [operacao]; // $1 = recurso (used in INNER JOIN below)
    let sc2Count = 2;

    const inactiveSql = getInactiveFilter(`COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),''))`);
    if (inactiveSql) sc2Conditions.push(inactiveSql.replace(/^\s*AND\s+/i, ''));

    if (op) {
      sc2Conditions.push(`TRIM(c2.c2_num) = $${sc2Count++}`);
      sc2Params.push(String(op).trim().padStart(6, '0'));
    }
    if (pedido) {
      const pedidoList = String(pedido).split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => p.padStart(6, '0'));

      if (pedidoList.length === 1) {
        sc2Conditions.push(`(c2.c2_pedido = $${sc2Count} OR root_op.c2_pedido = $${sc2Count})`);
        sc2Params.push(pedidoList[0]);
        sc2Count++;
      } else if (pedidoList.length > 1) {
        const placeholders = pedidoList.map((_, i) => `$${sc2Count + i}`).join(', ');
        sc2Conditions.push(`(c2.c2_pedido IN (${placeholders}) OR root_op.c2_pedido IN (${placeholders}))`);
        sc2Params.push(...pedidoList);
        sc2Count += pedidoList.length;
      }
    }
    if (produto) {
      const produtoTrimmed = produto.trim().toUpperCase();
      const matchDireto = produtosDoRecurso.some(p => p.toUpperCase().includes(produtoTrimmed));
      if (matchDireto) {
        sc2Conditions.push(`TRIM(c2.c2_produto) ILIKE $${sc2Count++}`);
        sc2Params.push(`%${produto.trim()}%`);
      } else {
        const bomLookup = await db.query(`
          SELECT DISTINCT TRIM(g1.g1_cod) AS pai FROM public.sg1010 g1
          WHERE TRIM(g1.g1_comp) ILIKE $1 AND TRIM(g1.g1_cod) = ANY($2) AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')
        `, [`%${produtoTrimmed}%`, produtosDoRecurso]);
        if (bomLookup.rows.length > 0) {
          const paiCodes = bomLookup.rows.map(r => r.pai);
          console.log(`🔍 [VERTICAL] "${produtoTrimmed}" via BOM: ${paiCodes.join(', ')}`);
          sc2Conditions.push(`TRIM(c2.c2_produto) = ANY($${sc2Count++})`);
          sc2Params.push(paiCodes);
        } else {
          sc2Conditions.push(`TRIM(c2.c2_produto) ILIKE $${sc2Count++}`);
          sc2Params.push(`%${produto.trim()}%`);
        }
      }
    }
    if (cliente) {
      // PERF-FIX: Busca os pedidos do cliente primeiro para evitar Nested Loop gigante
      const inactiveSqlCliente = getInactiveFilter('c6.c6_num');
      const clienteQuery = `
        SELECT TRIM(c6.c6_num) as pedido
        FROM public.sc6010 c6
        INNER JOIN public.sa1010 a1 ON TRIM(a1.a1_cod) = TRIM(c6.c6_cli) AND TRIM(a1.a1_loja) = TRIM(c6.c6_loja)
        WHERE (TRIM(a1.a1_nome) ILIKE $1 OR TRIM(a1.a1_nreduz) ILIKE $1)
          AND COALESCE(c6.d_e_l_e_t_, '') = ''
          AND COALESCE(a1.d_e_l_e_t_, '') = ''
          AND c6.c6_qtdven > c6.c6_qtdent
          ${inactiveSqlCliente ? `AND ${inactiveSqlCliente.replace(/^\s*AND\s+/i, '')}` : ''}
      `;
      const pedsResult = await db.query(clienteQuery, [`%${cliente.trim()}%`]);
      const pedsClient = pedsResult.rows.map(r => r.pedido).filter(Boolean);
      
      if (pedsClient.length === 0) {
        return res.json({ data: [], pagination: { page, limit, hasMore: false, total: 0 } });
      }

      sc2Conditions.push(`(TRIM(c2.c2_pedido) = ANY($${sc2Count}) OR TRIM(root_op.c2_pedido) = ANY($${sc2Count}))`);
      sc2Params.push(pedsClient);
      sc2Count++;
    }
    if (opFilterFromMySQL && opFilterFromMySQL.length > 0) {
      sc2Conditions.push(`TRIM(c2.c2_num) = ANY($${sc2Count++})`);
      sc2Params.push(opFilterFromMySQL);
    }

    const sc2Where = `WHERE ${sc2Conditions.join(' AND ')}`;

    // Main query: INNER JOIN sg2010 replaces the huge ANY($produtos) array
    const pgQuery = `
      SELECT
        TRIM(c2.c2_num)    AS op,
        TRIM(c2.c2_item)   AS item_op,
        TRIM(c2.c2_sequen) AS sequen_op,
        TRIM(c2.c2_produto) AS produto,
        COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) AS raw_pedido,
        COALESCE(NULLIF(TRIM(c2.c2_obs),''),    NULLIF(TRIM(root_op.c2_obs),''))    AS obs_venda,
        COALESCE(NULLIF(TRIM(c2.c2_itempv),''), NULLIF(TRIM(root_op.c2_itempv),'')) AS item_pedido,
        c2.c2_quant::numeric AS qtd_op,
        COALESCE(TRIM(c6.c6_descri), TRIM(b1.b1_desc)) AS desc_produto,
        CASE WHEN c6.c6_entreg IS NOT NULL AND c6.c6_entreg <> ''
          THEN TO_CHAR(TO_DATE(c6.c6_entreg, 'YYYYMMDD'), 'YYYY-MM-DD')
          ELSE NULL END AS data_entrega,
        TRIM(c6.c6_cli)  AS c6_cli,
        TRIM(a1.a1_nome) AS nome_cliente,
        g2_r.g2_tempad   AS g2_tempad,
        COALESCE(g2_r.g2_setup, 0) AS g2_setup
      FROM public.sc2010 c2
      INNER JOIN public.sg2010 g2_r
        ON TRIM(g2_r.g2_produto) = TRIM(c2.c2_produto)
        AND TRIM(g2_r.g2_recurso) = $1
        AND COALESCE(g2_r.d_e_l_e_t_, '') IN ('', ' ')
      LEFT JOIN public.sc2010 root_op
        ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item
        AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sc6010 c6
        ON TRIM(c6.c6_num)  = COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),''))
        AND TRIM(c6.c6_item) = COALESCE(NULLIF(TRIM(c2.c2_itempv),''), NULLIF(TRIM(root_op.c2_itempv),''))
        AND COALESCE(c6.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sa1010 a1
        ON TRIM(a1.a1_cod) = TRIM(c6.c6_cli) AND TRIM(a1.a1_loja) = TRIM(c6.c6_loja)
        AND COALESCE(a1.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto) AND COALESCE(b1.d_e_l_e_t_, '') = ''
      ${sc2Where}
      LIMIT 5000
    `;

    const verticalClient = await db.connect();
    let pgResult;
    try {
      await verticalClient.query('SET statement_timeout = 120000');
      pgResult = await verticalClient.query(pgQuery, sc2Params);
    } finally {
      verticalClient.release();
    }

    // Enrich with routing map
    pgResult.rows.forEach(row => {
      const routes = routingMap[row.produto] || [];
      const route  = routes[0] || {};
      row.operacao_codigo = route.operacao_codigo || null;
      row.operacao_desc   = route.operacao_desc   || null;
      row.recurso_codigo  = route.recurso_codigo  || operacao;
      if (produto && row.produto.toUpperCase() !== produto.trim().toUpperCase()) {
        row.componente_buscado = produto.trim().toUpperCase();
      }
    });

    const opsList = pgResult.rows;
    console.log(`📋 [VERTICAL] ${opsList.length} OPs retornadas (page ${page})`);

    if (opsList.length === 0) {
      return res.json({ data: [], pagination: { page, limit, hasMore: false, total: 0 } });
    }

    // Enrichment: MySQL planning + appointments
    const opCodes = [...new Set(opsList.map(o => o.op))];
    const opCodOperacoes = [...new Set(opsList.map(o => o.operacao_codigo).filter(Boolean))];
    const opPlaceholders = opCodes.map(() => '?').join(',');
    const opOperacPlaceholders = opCodOperacoes.map(() => '?').join(',');

    let plans = [], appointments = [];
    if (opCodes.length > 0 && opCodOperacoes.length > 0) {
      const [pRows] = await mysqlPool.query(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim, dias_espera
        FROM app_production_planning
        WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
      `, [...opCodes, ...opCodOperacoes]);
      plans = pRows;

      const [aRows] = await mysqlPool.query(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo,
               SUM(quantidade) as total_produzido, MIN(data_inicio) as primeira_data,
               MAX(data_fim) as ultima_data, GROUP_CONCAT(DISTINCT usuario SEPARATOR ', ') as usuarios
        FROM app_production_appointments
        WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
        AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
        GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
      `, [...opCodes, ...opCodOperacoes]);
      appointments = aRows;
    }

    // Fetch checklist status for OPs
    let checklistStatuses = [];
    if (opCodes.length > 0) {
      try {
        const [cRows] = await mysqlPool.query(
          `SELECT op, item_op, sequen_op, status FROM app_montagem_checklist WHERE op IN (${opPlaceholders})`,
          [...opCodes]
        );
        checklistStatuses = cRows;
      } catch (err) {
        console.error('⚠️ [VERTICAL] Erro checklist status:', err.message);
      }
    }

    // Docs from MySQL
    const codigosProdutos = [...new Set(opsList.map(o => o.produto).filter(Boolean))];
    const docsMap = {};
    if (codigosProdutos.length > 0) {
      try {
        const prodPlaceholders = codigosProdutos.map(() => '?').join(',');
        const [docsResult] = await mysqlPool.query(
          `SELECT produto_codigo, url_arquivo, tipo, titulo FROM produtos_docs WHERE produto_codigo IN (${prodPlaceholders})`,
          codigosProdutos
        );
        docsResult.forEach(d => {
          if (d.url_arquivo && String(d.url_arquivo).trim() !== '') {
            if (!docsMap[d.produto_codigo]) docsMap[d.produto_codigo] = [];
            docsMap[d.produto_codigo].push(d);
          }
        });
      } catch (err) {
        console.error('⚠️ [VERTICAL] Erro docs:', err.message);
      }
    }

    // Roteiro completo por produto para identificar operação anterior e posterior
    let fullRoutingMap = {};
    if (codigosProdutos.length > 0) {
      try {
        const fullRoteiroResult = await db.query(`
          SELECT TRIM(g2.g2_produto) AS produto, TRIM(g2.g2_operac) AS operacao_codigo, TRIM(g2.g2_recurso) AS recurso_codigo
          FROM public.sg2010 g2
          WHERE TRIM(g2.g2_produto) = ANY($1) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
          ORDER BY g2.g2_produto ASC, g2.g2_operac ASC
        `, [codigosProdutos]);
        fullRoteiroResult.rows.forEach(r => {
          if (!fullRoutingMap[r.produto]) fullRoutingMap[r.produto] = [];
          fullRoutingMap[r.produto].push({ operacao_codigo: r.operacao_codigo, recurso_codigo: r.recurso_codigo });
        });
      } catch (e) { /* não bloqueia */ }
    }

    // Mapa rowKey -> operacao anterior e posterior
    const prevOpMap = {};
    const nextOpMap = {};
    opsList.forEach(opRow => {
      const currentEntry = routingMap[opRow.produto]?.[0];
      if (!currentEntry) return;
      const allOps = fullRoutingMap[opRow.produto] || [];
      const idx = allOps.findIndex(op => op.operacao_codigo === currentEntry.operacao_codigo);
      if (idx > 0) {
        prevOpMap[`${opRow.op}_${opRow.item_op}_${opRow.sequen_op}`] = allOps[idx - 1];
      }
      if (idx !== -1 && idx < allOps.length - 1) {
        nextOpMap[`${opRow.op}_${opRow.item_op}_${opRow.sequen_op}`] = allOps[idx + 1];
      }
    });

    // Busca apontamentos das operações adjacentes (anteriores e próximas)
    const adjacentOpCodes = [...new Set([
      ...Object.values(prevOpMap).map(o => o.operacao_codigo),
      ...Object.values(nextOpMap).map(o => o.operacao_codigo)
    ].filter(Boolean))];
    let adjacentAppointments = [];
    if (opCodes.length > 0 && adjacentOpCodes.length > 0) {
      try {
        const adjOpPH = adjacentOpCodes.map(() => '?').join(',');
        const [adjARows] = await mysqlPool.query(
          `SELECT op_numero, op_item, operacao_codigo, SUM(quantidade) AS total_produzido
           FROM app_production_appointments
           WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${adjOpPH})
           AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
           GROUP BY op_numero, op_item, operacao_codigo`,
          [...opCodes, ...adjacentOpCodes]
        );
        adjacentAppointments = adjARows;
      } catch (e) { /* não bloqueia */ }
    }

    // Busca de prioridades de OP
    let priorityMap = {};
    if (opsList.length > 0) {
      try {
        const fullOps = [...new Set(opsList.map(o => `${o.op}${o.item_op}${o.sequen_op}`))];
        const prefixOps = [...new Set(opsList.map(o => `${o.op}${o.item_op}`))]; // 8 chars (pedido/item)
        
        const opsToCheck = [...new Set([...fullOps, ...prefixOps])];
        if (opsToCheck.length > 0) {
          const ph = opsToCheck.map(() => '?').join(',');
          const [pRows] = await mysqlPool.query(
            `SELECT op_numero, prioridade FROM app_op_priorities WHERE op_numero IN (${ph})`,
            opsToCheck
          );
          pRows.forEach(r => { priorityMap[r.op_numero] = r.prioridade; });
        }
      } catch (e) {
        console.error('[PRIORITY FETCH ERROR]', e);
      }
    }

    // Merge final
    const enrichedList = opsList.map(opRow => {
      const fullOpNum = `${opRow.op}${opRow.item_op}${opRow.sequen_op}`;
      const p = plans.find(plan =>
        plan.op_numero === opRow.op && plan.op_item === opRow.item_op &&
        plan.op_sequencia === opRow.sequen_op && plan.operacao_codigo === opRow.operacao_codigo
      );
      const a = appointments.find(appt =>
        appt.op_numero === opRow.op && appt.op_item === opRow.item_op &&
        appt.op_sequencia === opRow.sequen_op && appt.operacao_codigo === opRow.operacao_codigo
      );
      const qtd_planejada = parseFloat(opRow.qtd_op) || 0;
      const qtd_apontada  = a ? (parseFloat(a.total_produzido) || 0) : 0;
      let itemStatus = 'PENDENTE';
      if (qtd_apontada >= qtd_planejada && qtd_planejada > 0) itemStatus = 'CONCLUIDO';
      else if (qtd_apontada > 0) itemStatus = 'PARCIAL';
      const docs = docsMap[opRow.produto] || [];
      const rawP = (opRow.raw_pedido || '').trim();
      const rawO = (opRow.obs_venda  || '').trim();
      
      const checklistMatch = checklistStatuses.find(c => 
        String(c.op).trim() === String(opRow.op).trim() && 
        String(c.item_op).trim() === String(opRow.item_op).trim() && 
        String(c.sequen_op).trim() === String(opRow.sequen_op).trim()
      );
      const checklist_status = checklistMatch ? checklistMatch.status : null;

      return {
        ...opRow,
        op_prioridade: priorityMap[fullOpNum] || priorityMap[`${opRow.op}${opRow.item_op}`] || 0,
        status: itemStatus,
        checklist_status,
        pedido: rawP || (rawO.match(/^\d+/)?.[0] || ''),
        planejamento_inicio: p ? p.data_planejada_inicio : null,
        planejamento_fim:    p ? p.data_planejada_fim    : null,
        dias_espera:         p ? (p.dias_espera || 0) : 0,
        qtd_apontada,
        usuarios_apontamento:    a ? a.usuarios   : null,
        ultima_data_apontamento: a ? a.ultima_data : null,
        tem_arquivos:    docs.length > 0,
        primeiro_arquivo: docs.length > 0 ? docs[0].url_arquivo : null,
        arquivos: docs,
        tempad: Math.round((parseFloat(opRow.g2_tempad) || 0) * 1000) / 1000,
        setup:  parseFloat(opRow.g2_setup) || 0,
        op_anterior: (() => {
          const prevOp = prevOpMap[`${opRow.op}_${opRow.item_op}_${opRow.sequen_op}`];
          if (!prevOp) return null;
          const pa = adjacentAppointments.find(a => a.op_numero === opRow.op && a.op_item === opRow.item_op && a.operacao_codigo === prevOp.operacao_codigo);
          const qtd_pl = parseFloat(opRow.qtd_op) || 0;
          const qtd_ap = pa ? (parseFloat(pa.total_produzido) || 0) : 0;
          const st = qtd_ap >= qtd_pl && qtd_pl > 0 ? 'CONCLUIDO' : qtd_ap > 0 ? 'PARCIAL' : 'PENDENTE';
          return {
            operacao_codigo: prevOp.operacao_codigo,
            recurso_codigo: prevOp.recurso_codigo,
            qtd_apontada: qtd_ap,
            status: st
          };
        })(),
        op_proxima: (() => {
          const nextOp = nextOpMap[`${opRow.op}_${opRow.item_op}_${opRow.sequen_op}`];
          if (!nextOp) return null;
          const na = adjacentAppointments.find(a => a.op_numero === opRow.op && a.op_item === opRow.item_op && a.operacao_codigo === nextOp.operacao_codigo);
          const qtd_pl = parseFloat(opRow.qtd_op) || 0;
          const qtd_ap = na ? (parseFloat(na.total_produzido) || 0) : 0;
          const st = qtd_ap >= qtd_pl && qtd_pl > 0 ? 'CONCLUIDO' : qtd_ap > 0 ? 'PARCIAL' : 'PENDENTE';
          return {
            operacao_codigo: nextOp.operacao_codigo,
            recurso_codigo: nextOp.recurso_codigo,
            qtd_apontada: qtd_ap,
            status: st
          };
        })()
      };
    });

    // Filtro Final por Datas Planejadas na própria operação (Timezone Safe)
    const toYMD = (d) => {
      if (!d) return null;
      try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return null;
        const tzOffset = dateObj.getTimezoneOffset() * 60000;
        return new Date(dateObj.getTime() - tzOffset).toISOString().substring(0, 10);
      } catch (e) { return null; }
    };

    let finalList = enrichedList;
    if (plan_inicio_de) {
      finalList = finalList.filter(r => toYMD(r.planejamento_inicio) && toYMD(r.planejamento_inicio) >= String(plan_inicio_de));
    }
    if (plan_inicio_ate) {
      finalList = finalList.filter(r => !toYMD(r.planejamento_inicio) || toYMD(r.planejamento_inicio) <= String(plan_inicio_ate));
    }
    if (plan_fim_de) {
      finalList = finalList.filter(r => toYMD(r.planejamento_fim) && toYMD(r.planejamento_fim) >= String(plan_fim_de));
    }
    if (plan_fim_ate) {
      finalList = finalList.filter(r => toYMD(r.planejamento_fim) && toYMD(r.planejamento_fim) <= String(plan_fim_ate));
    }

    // Apply Status Filter
    if (status && status !== 'ALL') {
      if (status === 'ABERTOS') {
        finalList = finalList.filter(r => r.status !== 'CONCLUIDO');
      } else {
        finalList = finalList.filter(r => r.status === status);
      }
    }

    // Apply Sorting
    finalList.sort((a, b) => {
      // 1. Sempre ordena por prioridade primeiro (maior para menor)
      if (a.op_prioridade !== b.op_prioridade) {
        return (b.op_prioridade || 0) - (a.op_prioridade || 0);
      }

      const sKey = sort_key || 'data_entrega';
      const sDir = sort_dir === 'desc' ? 'desc' : 'asc';
      
      if (sKey === 'planejamento_inicio') {
        const dateA = a.planejamento_inicio ? new Date(a.planejamento_inicio).getTime() : (sDir === 'asc' ? Infinity : -Infinity);
        const dateB = b.planejamento_inicio ? new Date(b.planejamento_inicio).getTime() : (sDir === 'asc' ? Infinity : -Infinity);
        if (dateA !== dateB) return sDir === 'asc' ? dateA - dateB : dateB - dateA;
        return a.op.localeCompare(b.op);
      }
      if (sKey === 'data_entrega') {
        const dateA = a.data_entrega ? new Date(a.data_entrega).getTime() : (sDir === 'asc' ? Infinity : -Infinity);
        const dateB = b.data_entrega ? new Date(b.data_entrega).getTime() : (sDir === 'asc' ? Infinity : -Infinity);
        if (dateA !== dateB) return sDir === 'asc' ? dateA - dateB : dateB - dateA;
        return a.op.localeCompare(b.op);
      }

      let aVal = a[sKey];
      let bVal = b[sKey];

      if (sKey === 'progresso') {
        aVal = a.qtd_op > 0 ? (a.qtd_apontada / a.qtd_op) : 0;
        bVal = b.qtd_op > 0 ? (b.qtd_apontada / b.qtd_op) : 0;
      }

      if (aVal === bVal) {
        return a.op.localeCompare(b.op); // Fallback para manter consistência
      }
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'string') {
        return sDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const total = finalList.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offsetCalc = (page - 1) * limit;
    const paginatedList = finalList.slice(offsetCalc, offsetCalc + limit);
    const hasMore = (offsetCalc + limit) < total;

    res.json({
      data: paginatedList,
      pagination: { page, limit, hasMore, total, totalPages }
    });

  } catch (err) {
    require('fs').writeFileSync('vertical_error.txt', String(err.stack || err.message));
    console.error('❌ [VERTICAL ROUTE ERROR] message:', err.message);
    console.error('❌ [VERTICAL ROUTE ERROR] code:', err.code);
    if (err.code === '53300' || err.code === '53100') {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível. Tente novamente em instantes.', code: err.code });
    }
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ============================================================
// GET /api/producao/search-ops
// Busca lista de OPs com filtros dinâmicos para o seletor
// ============================================================
router.get('/search-ops', async (req, res) => {
  try {
    const { op, pedido, cliente, produto, prazo_de, prazo_ate, limit: lim = 50 } = req.query;

    if (!op && !pedido && !cliente && !produto && !prazo_de && !prazo_ate) {
      return res.status(400).json({ error: 'Informe ao menos um filtro.' });
    }

    const params = [];
    let pCount = 1;
    let conditions = ["COALESCE(c2.d_e_l_e_t_, '') = ''"];

    if (op) {
      conditions.push(`TRIM(c2.c2_num) ILIKE $${pCount++}`);
      params.push(`%${op.trim()}%`);
    }
    if (pedido) {
      conditions.push(`TRIM(c2.c2_pedido) ILIKE $${pCount++}`);
      params.push(`%${pedido.trim()}%`);
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

    const getInactiveFilter = await getInactiveOrdersFilter();
    const inactiveSql = getInactiveFilter('c2.c2_pedido');
    if (inactiveSql) conditions.push(inactiveSql.replace(/^\s*AND\s+/i, ''));

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

// ============================================================
// GET /api/producao/op-roteiro-saldo
// Retorna as operações do roteiro de um item de OP + saldos
// ============================================================
router.get('/op-roteiro-saldo', async (req, res) => {
  try {
    const { op, item, sequencia, produto } = req.query;
    if (!op || !item || !produto) {
      return res.status(400).json({ error: 'op, item e produto são obrigatórios.' });
    }

    // 1. Buscar roteiro daquele produto em sg2010
    const sgQuery = `
      SELECT
        TRIM(g2.g2_produto)  AS produto,
        TRIM(g2.g2_operac)   AS operacao_codigo,
        TRIM(g2.g2_recurso)  AS recurso_codigo,
        TRIM(COALESCE(h1.h1_descri, g2.g2_descri, g2.g2_recurso)) AS operacao_desc
      FROM public.sg2010 g2
      LEFT JOIN public.sh1010 h1
        ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
        AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
      WHERE TRIM(g2.g2_produto) = $1
        AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
      ORDER BY g2.g2_operac ASC
    `;
    const sgResult = await db.query(sgQuery, [produto.trim()]);
    const operacoes = sgResult.rows;

    if (operacoes.length === 0) {
      return res.json([]);
    }

    // 2. Quantidade total da OP em SC2
    const sc2Query = `
      SELECT CAST(c2_quant AS numeric) AS qtd_op
      FROM public.sc2010
      WHERE TRIM(c2_num) = $1 AND TRIM(c2_item) = $2 AND TRIM(c2_sequen) = $3
      AND COALESCE(d_e_l_e_t_, '') = ''
      LIMIT 1
    `;
    const sc2Result = await db.query(sc2Query, [op.trim().padStart(6, '0'), item.trim(), (sequencia || '001').trim()]);
    const qtd_op = sc2Result.rows.length > 0 ? Number(sc2Result.rows[0].qtd_op) : 0;

    // 3. Buscar apontamentos no MySQL
    const opCodOperacoes = operacoes.map(o => o.operacao_codigo);
    const placeholders = opCodOperacoes.map(() => '?').join(',');
    
    let appointments = [];
    if (opCodOperacoes.length > 0) {
      const [aRows] = await mysqlPool.query(`
        SELECT operacao_codigo, SUM(quantidade) as total_produzido
        FROM app_production_appointments
        WHERE op_numero = ? AND op_item = ? AND op_sequencia = ?
        AND operacao_codigo IN (${placeholders})
        AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
        GROUP BY operacao_codigo
      `, [op.trim().padStart(6, '0'), item.trim(), (sequencia || '001').trim(), ...opCodOperacoes]);
      appointments = aRows;
    }

    // 4. Mapear resposta
    const resultado = operacoes.map(opRow => {
      const appt = appointments.find(a => a.operacao_codigo === opRow.operacao_codigo);
      const produzido = appt ? Number(appt.total_produzido) : 0;
      const saldo = Math.max(0, qtd_op - produzido);
      
      return {
        ...opRow,
        op: op.trim().padStart(6, '0'),
        item_op: item.trim(),
        sequen: (sequencia || '001').trim(),
        qtd_planejada_op: qtd_op,
        qtd_produzida_real: produzido,
        saldo: saldo
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error('❌ [OP-ROTEIRO-SALDO]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- CHECKLIST ROUTES ---

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage config for checklist photos
const checklistStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/checklists');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const checklistUpload = multer({ storage: checklistStorage });

// 1. Obter checklist da OP
router.get('/checklist/:op/:item_op/:sequen_op', async (req, res) => {
    try {
        const { op, item_op, sequen_op } = req.params;
        const [checklistRows] = await mysqlPool.query(
            `SELECT idChecklist, op, item_op, sequen_op, produto_pai, idUsuario, real_datetime, data_finalizado, qtd_conjuntos, observacao_geral, status, foto_url_pai
             FROM app_montagem_checklist 
             WHERE op = ? AND item_op = ? AND sequen_op = ?`,
            [op, item_op, sequen_op]
        );

        let checklist;
        let items = [];

        if (checklistRows.length > 0) {
            checklist = checklistRows[0];
            const [itemRows] = await mysqlPool.query(
                `SELECT idChecklistItem, idChecklist, codigo_componente, descricao_componente, montado, observacao, foto_url, qtd_necessaria, qtd_montada
                 FROM app_montagem_checklist_itens 
                 WHERE idChecklist = ?`,
                [checklist.idChecklist]
            );
            
            // Buscar a estrutura real do Protheus para garantir quantidades de engenharia atualizadas
            const structureResult = await db.query(
                `SELECT 
                     TRIM(g1.g1_comp) as codigo,
                     CAST(g1.g1_quant AS NUMERIC) as qtd_necessaria
                 FROM public.sg1010 g1
                 WHERE TRIM(g1.g1_cod) = $1
                   AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')`,
                [checklist.produto_pai]
            );
            const structureMap = {};
            structureResult.rows.forEach(r => {
                structureMap[r.codigo.trim()] = parseFloat(r.qtd_necessaria) || 1;
            });

            // Sobrescrever a quantidade necessária com a real da estrutura Protheus
            items = itemRows.map(item => {
                const code = (item.codigo_componente || '').trim();
                return {
                    ...item,
                    qtd_necessaria: structureMap[code] !== undefined ? structureMap[code] : (parseFloat(item.qtd_necessaria) || 1.0)
                };
            });
        } else {
            // Se não existe salvo, buscar a estrutura do produto na OP do Protheus
            const formattedOp = op.padStart(6, '0');
            const opResult = await db.query(
                `SELECT TRIM(c2_produto) as produto, c2_quant::numeric as qtd_op 
                 FROM public.sc2010 
                 WHERE TRIM(c2_num) = $1 AND TRIM(c2_item) = $2 AND TRIM(c2_sequen) = $3 
                   AND COALESCE(d_e_l_e_t_, '') IN ('', ' ') 
                 LIMIT 1`,
                [formattedOp, item_op, sequen_op]
            );

            if (opResult.rows.length === 0) {
                return res.json(null);
            }

            const produtoPai = opResult.rows[0].produto;
            const qtdOp = opResult.rows[0].qtd_op;

            const structureResult = await db.query(
                `SELECT 
                     TRIM(g1.g1_comp) as codigo,
                     TRIM(b1.b1_desc) as descricao,
                     CAST(g1.g1_quant AS NUMERIC) as qtd_necessaria
                 FROM public.sg1010 g1
                 LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp) 
                     AND COALESCE(b1.d_e_l_e_t_, '') IN ('', ' ')
                 WHERE TRIM(g1.g1_cod) = $1
                   AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')`,
                [produtoPai]
            );

            checklist = {
                op,
                item_op,
                sequen_op,
                produto_pai: produtoPai,
                qtd_conjuntos: qtdOp,
                observacao_geral: '',
                status: 'RASCUNHO',
                data_finalizado: null,
                foto_url_pai: null,
                is_template: true
            };

            items = structureResult.rows.map(row => ({
                codigo_componente: row.codigo,
                descricao_componente: row.descricao,
                montado: 0,
                observacao: '',
                foto_url: null,
                qtd_necessaria: row.qtd_necessaria,
                qtd_montada: 0
            }));
        }

        // Enriquecer itens com arquivos associados da tabela produtos_docs do MySQL
        const compCodes = items.map(i => i.codigo_componente);
        let docsMap = {};
        if (compCodes.length > 0) {
            const [docs] = await mysqlPool.query(
                `SELECT id, produto_codigo, url_arquivo, tipo, titulo 
                 FROM produtos_docs 
                 WHERE produto_codigo IN (${compCodes.map(() => '?').join(',')}) 
                 ORDER BY created_at DESC`,
                compCodes
            );
            docs.forEach(d => {
                const code = d.produto_codigo.trim();
                if (!docsMap[code]) docsMap[code] = [];
                docsMap[code].push(d);
            });
        }

        const itemsWithDocs = items.map(item => {
            const code = item.codigo_componente.trim();
            const arquivos = docsMap[code] || [];
            return {
                ...item,
                tem_arquivos: arquivos.length > 0,
                arquivos
            };
        });

        res.json({
            ...checklist,
            itens: itemsWithDocs
        });

    } catch (error) {
        console.error('Erro ao buscar checklist:', error);
        res.status(500).json({ error: 'Erro ao buscar checklist' });
    }
});

// 2. Salvar ou atualizar checklist (Rascunho ou Finalizado)
router.post('/checklist', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            op,
            item_op,
            sequen_op,
            produto_pai,
            data_finalizado,
            qtd_conjuntos,
            observacao_geral,
            status,
            foto_url_pai,
            itens
        } = req.body;

        const idUsuario = req.user ? req.user.id : 1; // fallback to 1 if no auth

        // Verificar se já existe e está finalizado
        const [existing] = await connection.query(
            `SELECT idChecklist, status FROM app_montagem_checklist WHERE op = ? AND item_op = ? AND sequen_op = ?`,
            [op, item_op, sequen_op]
        );

        if (existing.length > 0 && existing[0].status === 'FINALIZADO') {
            await connection.rollback();
            return res.status(403).json({ error: 'Este checklist já foi FINALIZADO e não pode mais ser alterado.' });
        }

        let idChecklist;
        if (existing.length > 0) {
            idChecklist = existing[0].idChecklist;
            // Atualizar cabeçalho
            await connection.query(
                `UPDATE app_montagem_checklist 
                 SET idUsuario = ?, data_finalizado = ?, qtd_conjuntos = ?, observacao_geral = ?, status = ?, foto_url_pai = ?
                 WHERE idChecklist = ?`,
                [idUsuario, data_finalizado || null, qtd_conjuntos || 1, observacao_geral || '', status || 'RASCUNHO', foto_url_pai || null, idChecklist]
            );
            // Deletar itens antigos para reinserir os novos
            await connection.query(`DELETE FROM app_montagem_checklist_itens WHERE idChecklist = ?`, [idChecklist]);
        } else {
            // Inserir cabeçalho
            const [result] = await connection.query(
                `INSERT INTO app_montagem_checklist (op, item_op, sequen_op, produto_pai, idUsuario, data_finalizado, qtd_conjuntos, observacao_geral, status, foto_url_pai)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [op, item_op, sequen_op, produto_pai, idUsuario, data_finalizado || null, qtd_conjuntos || 1, observacao_geral || '', status || 'RASCUNHO', foto_url_pai || null]
            );
            idChecklist = result.insertId;
        }

        // Inserir itens
        if (Array.isArray(itens) && itens.length > 0) {
            for (const item of itens) {
                await connection.query(
                    `INSERT INTO app_montagem_checklist_itens (idChecklist, codigo_componente, descricao_componente, montado, observacao, foto_url, qtd_necessaria, qtd_montada)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        idChecklist,
                        item.codigo_componente || item.codigo,
                        item.descricao_componente || item.descricao || '',
                        item.montado ? 1 : 0,
                        item.observacao || '',
                        item.foto_url || null,
                        parseFloat(item.qtd_necessaria) || 1.0000,
                        parseFloat(item.qtd_montada) || 0.0000
                    ]
                );
            }
        }

        await connection.commit();
        res.json({ success: true, idChecklist });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao salvar checklist:', error);
        res.status(500).json({ error: 'Erro ao salvar checklist' });
    } finally {
        connection.release();
    }
});

// 3. Upload de fotos para o checklist
router.post('/checklist/upload', checklistUpload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }
        // Retorna a URL relativa que pode ser acessada estaticamente
        const fileUrl = `/uploads/checklists/${req.file.filename}`;
        res.json({ url: fileUrl });
    } catch (error) {
        console.error('Erro no upload de foto do checklist:', error);
        res.status(500).json({ error: 'Erro ao processar upload da foto.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AJUSTE EM LOTE DE APONTAMENTOS (CONFIGURAÇÕES & PCP)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/producao/ajuste-apontamento/recursos - Lista completa de recursos (SH1010 + contagem SG2010)
router.get('/ajuste-apontamento/recursos', async (req, res) => {
    try {
        const query = `
            SELECT 
                TRIM(h1.h1_codigo) as codigo,
                TRIM(h1.h1_descri) as nome,
                COUNT(g2.g2_operac) as qtd_usos
            FROM public.sh1010 h1
            LEFT JOIN public.sg2010 g2 ON TRIM(g2.g2_recurso) = TRIM(h1.h1_codigo) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(h1.h1_codigo) NOT LIKE 'T000%'
            GROUP BY h1.h1_codigo, h1.h1_descri
            ORDER BY 
                CASE WHEN TRIM(h1.h1_codigo) LIKE 'MO%' THEN 1 WHEN TRIM(h1.h1_codigo) LIKE 'ST%' THEN 2 ELSE 3 END,
                COUNT(g2.g2_operac) DESC,
                h1.h1_codigo ASC
        `;
        const pgRes = await db.query(query);
        const rows = pgRes.rows || [];

        const recursos = rows.map(r => {
            const cod = String(r.codigo || '').trim().toUpperCase();
            let categoria = 'OUTROS';
            if (cod.startsWith('MO')) categoria = 'INTERNO';
            else if (cod.startsWith('ST') || cod.startsWith('MST')) categoria = 'TERCEIRO';

            return {
                codigo: cod,
                nome: String(r.nome || cod).trim(),
                categoria,
                qtd_usos: parseInt(r.qtd_usos || 0, 10)
            };
        });

        res.json(recursos);
    } catch (error) {
        console.error('❌ [AJUSTE APONTAMENTO RECURSOS ERRO]:', error);
        res.status(500).json({ error: error.message || 'Erro ao carregar lista de recursos.' });
    }
});

// POST /api/producao/ajuste-apontamento/preview - Simulação prévia das pendências
router.post('/ajuste-apontamento/preview', async (req, res) => {
    try {
        let { pedidos, recursos, modo } = req.body;

        // Normalização de Pedidos (suporta com e sem zeros à esquerda)
        let pedidosRaw = [];
        if (Array.isArray(pedidos)) {
            pedidosRaw = pedidos.map(p => String(p).trim()).filter(p => p.length > 0);
        } else if (typeof pedidos === 'string') {
            pedidosRaw = pedidos.split(/[\s,;]+/).map(p => p.trim()).filter(p => p.length > 0);
        }

        if (pedidosRaw.length === 0) {
            return res.status(400).json({ error: 'Informe ao menos um número de pedido válido.' });
        }

        const pedidosList = [...new Set([
            ...pedidosRaw.map(p => p.padStart(6, '0')),
            ...pedidosRaw.map(p => p.replace(/^0+/, '')).filter(p => p.length > 0)
        ])];

        // Normalização de Recursos
        let recursosList = [];
        if (Array.isArray(recursos) && recursos.length > 0) {
            recursosList = recursos.map(r => String(r).trim().toUpperCase());
        }

        console.log(`🔍 [AJUSTE APONTAMENTO PREVIEW] Pedidos: [${pedidosList.join(', ')}] | Recursos: [${recursosList.join(', ')}] | Modo: ${modo || 'FALTANTE_TOTAL'}`);

        // 1. Buscar OPs no Protheus (SC2010 + SG2010 + SB1010 + SH1010)
        let sc2Query = `
            SELECT 
                TRIM(c2.c2_num) as op_num,
                TRIM(c2.c2_item) as op_item,
                TRIM(c2.c2_sequen) as op_sequen,
                TRIM(c2.c2_produto) as produto,
                TRIM(sb1.b1_desc) as descricao,
                COALESCE(c2.c2_quant, 0) as qtd_op,
                COALESCE(c2.c2_quje, 0) as qtd_protheus,
                TRIM(c2.c2_pedido) as pedido,
                TRIM(c2.c2_itempv) as item_pedido,
                TRIM(g2.g2_operac) as operacao_codigo,
                TRIM(g2.g2_recurso) as recurso_codigo,
                TRIM(COALESCE(h1.h1_descri, g2.g2_recurso)) as recurso_nome,
                COALESCE(g2.g2_tempad, 0) as tempad
            FROM public.sc2010 c2
            INNER JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sh1010 h1 ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(c2.c2_produto) AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE (TRIM(c2.c2_pedido) = ANY($1) OR TRIM(c2.c2_num) = ANY($1))
              AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
        `;

        const params = [pedidosList];
        if (recursosList.length > 0) {
            sc2Query += ` AND TRIM(g2.g2_recurso) = ANY($2)`;
            params.push(recursosList);
        }

        sc2Query += ` ORDER BY TRIM(c2.c2_pedido), TRIM(c2.c2_num), TRIM(c2.c2_item), g2.g2_operac`;

        const pgRes = await db.query(sc2Query, params);
        const rows = pgRes.rows || [];

        if (rows.length === 0) {
            return res.json({
                items: [],
                totals: { total_ops: 0, concluidas: 0, pendentes: 0, total_pecas_faltantes: 0 },
                byRecurso: {},
                message: 'Nenhuma operação encontrada para os pedidos e recursos informados.'
            });
        }

        // 2. Buscar apontamentos acumulados no MySQL
        const opNums = [...new Set(rows.map(r => r.op_num))];
        const [appts] = await mysqlPool.query(`
            SELECT 
                TRIM(op_numero) as op_numero,
                TRIM(op_item) as op_item,
                TRIM(op_sequencia) as op_sequencia,
                TRIM(operacao_codigo) as operacao_codigo,
                SUM(CAST(quantidade AS DECIMAL(10,2))) as total_apontado
            FROM app_production_appointments
            WHERE op_numero IN (?)
              AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
        `, [opNums]);

        const apptMap = {};
        appts.forEach(a => {
            const num = String(a.op_numero || '').trim().padStart(6, '0');
            const it = String(a.op_item || '').trim();
            const seq = String(a.op_sequencia || '').trim();
            const opc = String(a.operacao_codigo || '').trim();
            const val = parseFloat(a.total_apontado || 0);

            const k1 = `${num}-${it}-${seq}-${opc}`;
            const k2 = `${num}-${it}-${opc}`;
            apptMap[k1] = (apptMap[k1] || 0) + val;
            apptMap[k2] = (apptMap[k2] || 0) + val;
        });

        // 3. Montar resultado detalhado e totalizadores
        let totalPecasFaltantes = 0;
        let concluidas = 0;
        let pendentes = 0;
        const byRecurso = {};

        const items = rows.map(r => {
            const num = String(r.op_num || '').trim().padStart(6, '0');
            const it = String(r.op_item || '').trim();
            const seq = String(r.op_sequen || '').trim();
            const opc = String(r.operacao_codigo || '').trim();

            const k1 = `${num}-${it}-${seq}-${opc}`;
            const k2 = `${num}-${it}-${opc}`;
            const qtdApontada = apptMap[k1] || apptMap[k2] || 0;
            const qtdOp = parseFloat(r.qtd_op || 0);
            const qtdProtheus = parseFloat(r.qtd_protheus || 0);

            let alvoCalculo = (modo === 'PROTHEUS_QUJE') ? qtdProtheus : qtdOp;
            const saldoFaltante = Math.max(0, alvoCalculo - qtdApontada);
            const isConcluido = saldoFaltante <= 0.001;

            if (isConcluido) {
                concluidas++;
            } else {
                pendentes++;
                totalPecasFaltantes += saldoFaltante;
            }

            const recKey = r.recurso_codigo;
            if (!byRecurso[recKey]) {
                byRecurso[recKey] = { codigo: recKey, nome: r.recurso_nome, total: 0, concluidas: 0, pendentes: 0, faltante: 0 };
            }
            byRecurso[recKey].total++;
            if (isConcluido) byRecurso[recKey].concluidas++;
            else {
                byRecurso[recKey].pendentes++;
                byRecurso[recKey].faltante += saldoFaltante;
            }

            return {
                pedido: r.pedido,
                item_pedido: r.item_pedido,
                op_numero: num,
                op_item: it,
                op_sequencia: seq,
                op_completa: `${num}-${it}-${seq}`,
                produto: r.produto,
                descricao: r.descricao,
                operacao_codigo: opc,
                recurso_codigo: r.recurso_codigo,
                recurso_nome: r.recurso_nome,
                qtd_op: qtdOp,
                qtd_protheus: qtdProtheus,
                qtd_apontada: qtdApontada,
                saldo_faltante: saldoFaltante,
                status: isConcluido ? 'CONCLUIDO' : 'PENDENTE'
            };
        });

        res.json({
            items,
            totals: {
                total_ops: rows.length,
                concluidas,
                pendentes,
                total_pecas_faltantes: totalPecasFaltantes
            },
            byRecurso
        });

    } catch (error) {
        console.error('❌ [AJUSTE APONTAMENTO PREVIEW ERRO]:', error);
        res.status(500).json({ error: error.message || 'Erro ao simular ajuste de apontamento.' });
    }
});

// POST /api/producao/ajuste-apontamento/executar - Execução da gravação em lote
router.post('/ajuste-apontamento/executar', async (req, res) => {
    let connection;
    try {
        const { items, usuario, observacao } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item selecionado para apontamento.' });
        }

        const userAssigned = usuario && String(usuario).trim().length > 0
            ? String(usuario).trim()
            : 'Sistema Automatico SINCO';

        const obsAssigned = observacao && String(observacao).trim().length > 0
            ? String(observacao).trim()
            : '[AJUSTE EM LOTE] Apontamento automático complementar PCP';

        const now = new Date();
        const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

        connection = await mysqlPool.getConnection();
        await connection.beginTransaction();

        let inseridos = 0;
        const opsAfetadas = new Set();

        for (const it of items) {
            const qtdNum = parseFloat(it.saldo_faltante || it.quantidade || 0);
            if (qtdNum <= 0.001) continue;

            const opNum = String(it.op_numero || '').trim().padStart(6, '0');
            const opItem = String(it.op_item || '').trim();
            const opSeq = String(it.op_sequencia || '').trim();
            const opCod = String(it.operacao_codigo || '').trim();

            await connection.execute(`
                INSERT INTO app_production_appointments
                (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo, usuario, quantidade, data_inicio, data_fim, observacao, conferencia_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OK', NOW())
            `, [
                opNum,
                opItem,
                opSeq,
                opCod,
                it.recurso_codigo || null,
                it.produto || null,
                userAssigned,
                qtdNum,
                nowStr,
                nowStr,
                obsAssigned
            ]);

            const concatenatedOp = opNum + opItem + opSeq;
            await connection.execute(`
                UPDATE app_lotes_corte_itens
                SET status = 'Concluído'
                WHERE op_numero = ?
            `, [concatenatedOp]);

            opsAfetadas.add(opNum);
            inseridos++;
        }

        await connection.commit();

        console.log(`✅ [AJUSTE APONTAMENTO EXECUTADO] Inseridos ${inseridos} registros por ${userAssigned}`);

        // Broadcast Socket.io se disponível
        try {
            const io = req.app.get('io');
            if (io) {
                io.emit('production_updated', { type: 'batch_appointment', ops: Array.from(opsAfetadas) });
            }
        } catch (socketErr) {
            console.warn('Socket broadcast aviso:', socketErr.message);
        }

        res.json({
            success: true,
            total_inseridos: inseridos,
            ops_afetadas: opsAfetadas.size,
            message: `Apontamento em lote concluído com sucesso! ${inseridos} operações apontadas.`
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ [AJUSTE APONTAMENTO EXECUTAR ERRO]:', error);
        res.status(500).json({ error: error.message || 'Erro ao executar apontamento em lote.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
