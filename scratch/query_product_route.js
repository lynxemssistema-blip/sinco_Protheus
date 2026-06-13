const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));

const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const db = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

(async () => {
    try {
        console.log('--- EXPLODING BOM FOR MT5-25776 ---');
        
        // 1. Recursive BOM query
        const bomQuery = `
            WITH RECURSIVE
            arvore AS (
                SELECT
                    TRIM(g1.g1_cod) as pai_original,
                    TRIM(g1.g1_cod) as pai, 
                    TRIM(g1.g1_comp) as filho, 
                    CAST(REPLACE(CAST(g1.g1_quant AS text), ',', '.') AS numeric) as qtd, 
                    TRIM(b1.b1_desc) as descricao,
                    1 as nivel,
                    ARRAY[TRIM(g1.g1_cod)] as visitados
                FROM public.sg1010 g1
                LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp) AND COALESCE(b1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE TRIM(g1.g1_cod) = 'MT5-25776'
                  AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')

                UNION ALL

                SELECT
                    a.pai_original,
                    TRIM(g1.g1_cod) as pai,
                    TRIM(g1.g1_comp) as filho,
                    CAST(REPLACE(CAST(g1.g1_quant AS text), ',', '.') AS numeric) as qtd,
                    TRIM(b1.b1_desc) as descricao,
                    a.nivel + 1,
                    a.visitados || TRIM(g1.g1_cod)
                FROM arvore a
                JOIN public.sg1010 g1 ON TRIM(g1.g1_cod) = a.filho AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp) AND COALESCE(b1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE a.nivel < 12
                  AND NOT (TRIM(g1.g1_cod) = ANY(a.visitados))
            )
            SELECT pai, filho, qtd, descricao, nivel FROM arvore
        `;
        const bomRes = await db.query(bomQuery);
        const bomItems = bomRes.rows;
        
        console.log(`Found ${bomItems.length} BOM components in hierarchy:`);
        console.table(bomItems);

        // Gather all products in structure: root itself + children
        const allProductsSet = new Set(['MT5-25776']);
        bomItems.forEach(item => {
            allProductsSet.add(item.filho);
            allProductsSet.add(item.pai);
        });
        const allProducts = Array.from(allProductsSet);

        // 2. Fetch routing for all these products
        console.log('\n--- ROUTING FOR PRODUCTS IN STRUCTURE ---');
        const placeholders = allProducts.map((_, i) => `$${i + 1}`).join(',');
        const routingQuery = `
            SELECT 
                TRIM(g2_produto) AS produto,
                TRIM(g2_operac) AS operac,
                TRIM(g2_recurso) AS recurso,
                g2_tempad AS tempo_minutos,
                TRIM(g2_descri) AS descri
            FROM public.sg2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(g2_produto) IN (${placeholders})
            ORDER BY g2_produto, g2_operac
        `;
        const routingRes = await db.query(routingQuery, allProducts);
        const routingRows = routingRes.rows;
        console.table(routingRows);

        // 3. Compute requirements for 10 units of MT5-25776
        // To do this, we need to resolve quantities recursively.
        // Let's build a multiplier map for each component.
        const qtyMultiplier = { 'MT5-25776': 10 };
        
        // Sort BOM items by level to calculate cascading quantities correctly
        const sortedBom = [...bomItems].sort((a, b) => a.nivel - b.nivel);
        for (const item of sortedBom) {
            const parentQty = qtyMultiplier[item.pai] || 0;
            const itemQty = parentQty * Number(item.qtd);
            qtyMultiplier[item.filho] = (qtyMultiplier[item.filho] || 0) + itemQty;
        }

        console.log('\n--- QUANTITIES NEEDED FOR 10 UNITS OF MT5-25776 ---');
        console.log(qtyMultiplier);

        // Calculate resources sum
        const resourceTotals = {};
        for (const prod in qtyMultiplier) {
            const qty = qtyMultiplier[prod];
            const routes = routingRows.filter(r => r.produto === prod);
            for (const r of routes) {
                const totalMinutes = qty * Number(r.tempo_minutos);
                if (!resourceTotals[r.recurso]) {
                    resourceTotals[r.recurso] = { minutes: 0, ops: [] };
                }
                resourceTotals[r.recurso].minutes += totalMinutes;
                resourceTotals[r.recurso].ops.push({
                    produto: prod,
                    quantidade: qty,
                    tempo_unitario: Number(r.tempo_minutos),
                    tempo_total: totalMinutes,
                    operacao: r.operac
                });
            }
        }

        console.log('\n--- TOTAL RESOURCE REQUIREMENTS FOR 10 UNITS ---');
        for (const rec in resourceTotals) {
            console.log(`\nRecurso: ${rec} - Total: ${resourceTotals[rec].minutes.toFixed(2)} min`);
            console.table(resourceTotals[rec].ops);
        }

        console.log('\n--- ALL RESOURCES IN MYSQL app_recursos_capacidade ---');
        const mysql = require('mysql2/promise');
        const mPool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB,
            port: Number(process.env.MYSQL_PORT) || 3306
        });
        
        const [rows] = await mPool.query(`
            SELECT * FROM app_recursos_capacidade ORDER BY ordem_exibicao
        `);
        console.table(rows);
        await mPool.end();

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.end();
    }
})();
