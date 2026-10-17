const db = require('./db');

async function diagnostico() {
    try {
        console.log("=== INICIANDO DIAGNÓSTICO DE CORTE ===");

        // 1. Achar o pedido 40002 (pode ser '040002' ou '40002')
        const qPedido = `
            SELECT TRIM(c6_produto) as produto, TRIM(c6_item) as item, c6_num
            FROM sc6010
            WHERE d_e_l_e_t_ = '' AND (TRIM(c6_num) = '40002' OR TRIM(c6_num) = '040002' OR TRIM(c6_num) = '004002')
        `;
        const resPed = await db.query(qPedido);
        if (resPed.rows.length === 0) {
            console.log("Pedido 40002 não encontrado no SC6.");
            return process.exit(0);
        }

        console.log(`Encontrados ${resPed.rows.length} itens no pedido ${resPed.rows[0].c6_num}.`);

        const produto = resPed.rows[0].produto;
        console.log(`Testando a explosão para o produto pai: ${produto}`);


        // 2. Verificar a explosão (apenas SG1)
        const qExplode = `
        WITH RECURSIVE bom AS (
            SELECT 
                TRIM(g1_comp) as child,
                g1_quant::numeric as quant,
                1 as level
            FROM sg1010
            WHERE d_e_l_e_t_ = '' AND g1_filial = '0101' AND TRIM(g1_cod) = $1
            
            UNION ALL
            
            SELECT 
                TRIM(sg1.g1_comp),
                (b.quant * sg1.g1_quant::numeric),
                b.level + 1
            FROM sg1010 sg1
            INNER JOIN bom b ON TRIM(sg1.g1_cod) = b.child
            WHERE sg1.d_e_l_e_t_ = '' AND sg1.g1_filial = '0101'
        )
        SELECT * FROM bom;
        `;
        const resExplode = await db.query(qExplode, [produto]);
        console.log(`Explosão encontrou ${resExplode.rows.length} componentes na árvore.`);

        if (resExplode.rows.length > 0) {
            // 3. Checar SG2 (Roteiro) para os filhos encontrados
            const children = resExplode.rows.map(r => `'${r.child}'`).join(',');
            const qSg2 = `
                SELECT TRIM(g2_produto) as produto, TRIM(g2_recurso) as recurso, TRIM(g2_operac) as operacao
                FROM sg2010
                WHERE d_e_l_e_t_ = '' AND TRIM(g2_produto) IN (${children})
                  AND TRIM(g2_recurso) IN ('MO0013', 'MO0012')
            `;
            const resSg2 = await db.query(qSg2);
            console.log(`Encontrados ${resSg2.rows.length} roteiros de Laser/Puncionadeira para os filhos.`);
            console.log(resSg2.rows);

            // 4. Se encontrou roteiro, tentar achar a chapa MTC
            if (resSg2.rows.length > 0) {
                const partsWithLaser = resSg2.rows.map(r => `'${r.produto}'`).join(',');
                const qMtc = `
                    SELECT TRIM(g1_cod) as pai, TRIM(g1_comp) as componente
                    FROM sg1010
                    WHERE d_e_l_e_t_ = '' AND g1_filial = '0101'
                      AND TRIM(g1_cod) IN (${partsWithLaser})
                      AND TRIM(g1_comp) LIKE 'MTC%'
                `;
                const resMtc = await db.query(qMtc);
                console.log(`Encontrados ${resMtc.rows.length} materiais MTC vinculados a essas peças.`);
                console.log(resMtc.rows);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

diagnostico();
