const db = require('./db');

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

    ( c2.c2_num
      || lpad(btrim(c2.c2_item),   2, '0')
      || lpad(btrim(c2.c2_sequen), 3, '0')
    ) AS op_origem

  FROM public.sc2010 c2
  WHERE
    c2.d_e_l_e_t_ = ' '
    AND c2.c2_num LIKE $1      -- Parâmetro OP
),

arvore AS (
  -- nível 0 (raiz)
  SELECT
    ob.c2_filial AS filial,
    ob.c2_num    AS op,
    ob.c2_item   AS item_op,
    ob.c2_sequen AS sequen_op,
    ob.op_origem,

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

    a.nivel + 1 AS nivel,
    CAST(g1.g1_comp AS text) AS cod_atual,
    CAST(g1.g1_cod AS text)  AS cod_pai,

    a.fator_rel * (CAST(REPLACE(CAST(g1.g1_quant AS text), ',', '.') AS numeric)) AS fator_rel,
    a.qtd_op,

    (a.caminho || ' > ' || g1.g1_comp) AS caminho,
    (a.visitados || CAST(g1.g1_comp AS text))  AS visitados

  FROM arvore a

  -- ✅ limita ramificação por pai (evita travar o pgAdmin se tiver BOM enorme)
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
    AND NOT (CAST(g1.g1_comp AS text) = ANY (a.visitados))-- ✅ anti-loop (ciclo)
)

SELECT
  a.op_origem,
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

(async () => {
    try {
        console.log('Testing SQL with OP parameter...');
        const op = '%3664%'; // Simulating LIKE search
        const start = Date.now();
        const res = await db.query(sql, [op]);
        console.log(`✅ Success! Found ${res.rowCount} rows in ${Date.now() - start}ms`);
        if (res.rowCount > 0) {
            console.log('First row sample:', res.rows[0]);
        } else {
            console.log('No rows returned. Is the OP number correct?');
        }
    } catch (err) {
        console.error('❌ SQL Error:', err);
    } finally {
        process.exit();
    }
})();
