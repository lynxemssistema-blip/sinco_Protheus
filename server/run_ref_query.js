const db = require('./db');

async function runRefQuery() {
    try {
        const query = `
SELECT
  TRIM(c5.C5_NUM)                     AS pedido,
  TRIM(c5.C5_CLIENTE)                 AS cliente,
  TRIM(c5.C5_LOJACLI)                 AS loja,
  sa1.A1_NOME                         AS nome_cliente,

  TRIM(c6.C6_ITEM)                    AS item,
  TRIM(c6.C6_PRODUTO)                 AS produto,
  sb1.B1_DESC                         AS descricao,

  -- Quantidade (pedido)
  COALESCE(c6.C6_QTDVEN, 0)::numeric(18,6) AS quantidade,

  -- Qtd Entregue (se existir no seu dicionário, normalmente é essa)
  COALESCE(c6.C6_QTDENT, 0)::numeric(18,6) AS qtd_entreg,

  -- Qtd Faturar (fallback: quantidade - entregue)
  (COALESCE(c6.C6_QTDVEN, 0) - COALESCE(c6.C6_QTDENT, 0))::numeric(18,6) AS qtd_faturar,

  -- Data de entrega (campo comum na SC6 é C6_ENTREG; se no seu não existir, remova)
  TRIM(COALESCE(c6.C6_ENTREG, ''))    AS entrega

FROM public.sc5010 c5
JOIN public.sc6010 c6
  ON COALESCE(c6.D_E_L_E_T_, '') = ''
 AND TRIM(c6.C6_FILIAL) = TRIM(c5.C5_FILIAL)
 AND TRIM(c6.C6_NUM)    = TRIM(c5.C5_NUM)

LEFT JOIN public.sa1010 sa1
  ON COALESCE(sa1.D_E_L_E_T_, '') = ''
 AND TRIM(sa1.A1_COD)   = TRIM(c5.C5_CLIENTE)
 AND TRIM(sa1.A1_LOJA)  = TRIM(c5.C5_LOJACLI)

LEFT JOIN public.sb1010 sb1
  ON COALESCE(sb1.D_E_l_E_T_, '') = ''
 AND TRIM(sb1.B1_COD) = TRIM(c6.C6_PRODUTO)

WHERE COALESCE(c5.D_E_L_E_T_, '') = ''
  AND TRIM(c5.C5_NUM) = '002553'
ORDER BY TRIM(c6.C6_ITEM);
        `;

        const result = await db.query(query);
        console.log(`Results for 002553: ${result.rows.length} items`);
        console.table(result.rows.map(r => ({
            item: r.item,
            prod: r.produto.trim(),
            qtd: parseFloat(r.quantidade),
            entreg: parseFloat(r.qtd_entreg),
            faturar: parseFloat(r.qtd_faturar)
        })));

    } catch (err) {
        console.error('SQL Error:', err);
    } finally {
        process.exit();
    }
}

runRefQuery();
