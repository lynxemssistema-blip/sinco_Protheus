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
      whereClause += `AND (c2.c2_num LIKE $${paramCount} OR c2.c2_pedido LIKE $${paramCount}) `;
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
    MAX(TRIM(c2.c2_pedido)) OVER (PARTITION BY c2.c2_num, c2.c2_item) AS pedido_venda,

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
    ob.pedido_venda,

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
  a.pedido_venda,
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

    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar estrutura por OP:', err);
    res.status(500).json({ error: 'Erro interno ao buscar dados da OP' });
  }
});

module.exports = router;
