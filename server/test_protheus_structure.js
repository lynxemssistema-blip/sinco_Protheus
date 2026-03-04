require('dotenv').config();
const db = require('./db');
const mysqlPool = require('./services/mysqlService');

async function testProtheusStructure(codProduto) {
    // Remove extensão se houver
    const codLimpo = codProduto.replace(/\.(asm|par|psm|dft)$/i, '');

    console.log(`\n--- Testando Estrutura Protheus para: "${codLimpo}" (Original: ${codProduto}) ---`);

    try {
        const check = await db.query(`SELECT COUNT(*) as count FROM public.sb1010 WHERE TRIM(B1_COD) = $1`, [codLimpo]);
        console.log(`SB1 Check: ${check.rows[0].count} encontrado(s).`);

        if (check.rows[0].count > 0) {
            const query = `
                WITH RECURSIVE Estrutura AS (
                    SELECT 
                        TRIM(b1.b1_cod) as codigo,
                        TRIM(b1.b1_desc) as descricao,
                        TRIM(b1.b1_um) as unidade,
                        1::numeric as qtd_necessaria,
                        0 as nivel,
                        ARRAY[TRIM(b1.b1_cod)]::text[] as path_array
                    FROM public.sb1010 b1
                    WHERE TRIM(b1.b1_cod) = $1 
                      AND COALESCE(b1.d_e_l_e_t_, '') IN ('', ' ')

                    UNION ALL

                    SELECT 
                        TRIM(g1.g1_comp) as codigo,
                        TRIM(b1.b1_desc) as descricao,
                        TRIM(b1.b1_um) as unidade,
                        (e.qtd_necessaria * CAST(g1.g1_quant AS NUMERIC)) as qtd_necessaria,
                        e.nivel + 1,
                        array_append(e.path_array, TRIM(g1.g1_comp))
                    FROM public.sg1010 g1
                    JOIN Estrutura e ON TRIM(g1.g1_cod) = e.codigo
                    LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp) 
                        AND COALESCE(b1.d_e_l_e_t_, '') IN ('', ' ')
                    WHERE COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')
                      AND NOT (TRIM(g1.g1_comp) = ANY(e.path_array))
                )
                SELECT 
                    codigo, 
                    descricao, 
                    unidade, 
                    qtd_necessaria, 
                    nivel 
                FROM Estrutura 
                ORDER BY path_array
                LIMIT 20;
            `;

            const res = await db.query(query, [codLimpo]);

            console.table(res.rows);
        } else {
            console.log('Produto não encontrado na SB1.');
        }

    } catch (err) {
        console.error('Erro:', err.message);
    }
}

async function run() {
    try {
        const [principais] = await mysqlPool.execute(`
            SELECT DISTINCT CodMatFabricante 
            FROM ordemservicoitem 
            WHERE ProdutoPrincipal = 'SIM' 
            LIMIT 5
        `);

        for (const p of principais) {
            await testProtheusStructure(p.CodMatFabricante);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
