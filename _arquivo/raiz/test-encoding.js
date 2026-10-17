
            const db = require('./db');
            
            async function run() {
                try {
                    const prodRows = await db.query("SELECT DISTINCT TRIM(g1_cod) as prod FROM sg1010 WHERE COALESCE(d_e_l_e_t_, '') = '' LIMIT 300");
                    const uniqueProducts = prodRows.rows.map(r => r.prod).filter(Boolean);
                    console.log('uniqueProducts count:', uniqueProducts.length);
                    
                    const client = await db.connect();
                    try {
                        await client.query("SET client_encoding TO 'WIN1252'");
                        const q = await client.query(
                            `WITH RECURSIVE bom AS (
                                SELECT TRIM(g1_cod) AS raiz, TRIM(g1_comp) AS comp, g1_quant::numeric AS quant, 1 AS nivel
                                FROM sg1010
                                WHERE TRIM(g1_cod) = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') = ''
                                UNION ALL
                                SELECT bom.raiz, TRIM(sg1.g1_comp), bom.quant * sg1.g1_quant::numeric, bom.nivel + 1
                                FROM sg1010 sg1
                                JOIN bom ON TRIM(sg1.g1_cod) = bom.comp
                                WHERE COALESCE(sg1.d_e_l_e_t_, '') = '' AND bom.nivel < 15
                            )
                            SELECT bom.raiz, bom.comp, SUM(bom.quant) as quant_total, 
                                   TRIM(MAX(sb1.b1_desc)) as desc, 
                                   TRIM(MAX(sb1.b1_um)) as um, 
                                   TRIM(MAX(sb1.b1_tipo)) as tipo,
                                   COALESCE(MAX(sb1.b1_custd), 0)::numeric as custo_unitario
                            FROM bom 
                            LEFT JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = bom.comp AND COALESCE(sb1.d_e_l_e_t_, '') = '' 
                            GROUP BY bom.raiz, bom.comp`,
                            [uniqueProducts]
                        );
                        console.log('Query with client_encoding WIN1252 succeeded! Row count:', q.rows.length);
                        console.log('First 2 rows:', q.rows.slice(0, 2));
                    } catch (e) {
                        console.log('Query with client_encoding WIN1252 failed:', e.message);
                    } finally {
                        client.release();
                    }
                    process.exit(0);
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            }
            run();
        