const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');
const db = require('../server/db');

async function testCurrentWay(data_inicio, data_fim, recurso, only_active) {
    console.log('\n--- TESTING CURRENT WAY ---');
    const start = Date.now();
    let pgClient;
    try {
        pgClient = await db.connect();
        
        // Passo 1
        let pgWhere = `
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_quje < c2.c2_quant
              AND TRIM(c2.c2_num) <> ''
              AND COALESCE(TRIM(c2.c2_pedido), '') <> ''
              AND TRIM(c2.c2_itempv) <> ''
        `;
        if (only_active === 'true') {
            pgWhere += ` AND (COALESCE(c5.c5_nota,'')='' OR EXISTS (
                SELECT 1 FROM public.sc6010 c6
                WHERE c6.c6_num=c5.c5_num AND c6.c6_filial=c5.c5_filial
                AND COALESCE(c6.d_e_l_e_t_,'')=''
                AND ((c6.c6_qtdven-c6.c6_qtdent)>0 OR c6.c6_qtdlib>0)))`;
        }

        const pgResult = await pgClient.query(`
            SELECT TRIM(c2.c2_num) AS op_num, TRIM(c2.c2_item) AS item_op,
                   TRIM(c2.c2_produto) AS produto, TRIM(c2.c2_pedido) AS pedido,
                   TRIM(c2.c2_itempv) AS item_pedido, c2.c2_quant AS qtde, c2.c2_quje AS qtde_feita,
                   TRIM(a1.a1_nome) AS cliente_nome
            FROM public.sc2010 c2
            LEFT JOIN public.sc5010 c5 ON TRIM(c5.c5_num)=TRIM(c2.c2_pedido) AND COALESCE(c5.d_e_l_e_t_,'') IN ('',' ')
            LEFT JOIN public.sa1010 a1 ON TRIM(a1.a1_cod)=TRIM(c5.c5_cliente) AND COALESCE(a1.d_e_l_e_t_,'') IN ('',' ')
            ${pgWhere}
            ORDER BY c2.c2_num, c2.c2_item LIMIT 10000
        `);
        const opRows = pgResult.rows;
        console.log(`Fetched ${opRows.length} OPs from Postgres in ${Date.now() - start}ms`);

        // Passo 2: Routing
        const step2Start = Date.now();
        const distinctProds = [...new Set(opRows.map(r => r.produto).filter(Boolean))];
        let pgRoutingRows = [];
        if (distinctProds.length > 0) {
            const routingParams = [distinctProds];
            let routingFilter = '';
            if (recurso) {
                routingParams.push(`%${recurso.toUpperCase().trim()}%`);
                routingFilter = ` AND (TRIM(g2.g2_recurso) LIKE $2 OR UPPER(TRIM(h1.h1_descri)) LIKE $2)`;
            }
            const pgRouting = await pgClient.query(`
                SELECT TRIM(g2.g2_produto) prod, TRIM(g2.g2_operac) operac,
                       TRIM(g2.g2_recurso) recurso, g2.g2_tempad tempo,
                       TRIM(h1.h1_descri) recurso_descri
                FROM public.sg2010 g2
                LEFT JOIN public.sh1010 h1 ON TRIM(h1.h1_codigo)=TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_,'') IN ('',' ')
                WHERE TRIM(g2.g2_produto) = ANY($1)
                  AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                  ${routingFilter}
            `, routingParams);
            pgRoutingRows = pgRouting.rows;
        }
        console.log(`Fetched ${pgRoutingRows.length} routing rows in ${Date.now() - step2Start}ms`);

        // Passo 3: Planning MySQL
        const step3Start = Date.now();
        const opNums = [...new Set(opRows.map(r => r.op_num).filter(Boolean))];
        let planRows = [];
        if (opNums.length > 0) {
            for (let i = 0; i < opNums.length; i += 500) {
                const chunk = opNums.slice(i, i + 500);
                const [rows] = await mysqlPool.query(`SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim FROM app_production_planning WHERE op_numero IN (?)`, [chunk]);
                planRows = planRows.concat(rows);
            }
        }
        console.log(`Fetched ${planRows.length} planning rows in ${Date.now() - step3Start}ms`);
        console.log(`Total current way time: ${Date.now() - start}ms`);
    } catch (err) {
        console.error(err);
    } finally {
        if (pgClient) pgClient.release();
    }
}

async function testOptimizedWay(data_inicio, data_fim, recurso, only_active) {
    console.log('\n--- TESTING OPTIMIZED WAY (MySQL First) ---');
    const start = Date.now();
    let pgClient;
    try {
        pgClient = await db.connect();

        // 1. Query planning rows in MySQL first, using dates and resource filters
        const step1Start = Date.now();
        let planQuery = `
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, data_planejada_inicio, data_planejada_fim 
            FROM app_production_planning 
            WHERE 1=1
        `;
        const planParams = [];
        if (data_inicio) {
            planQuery += ` AND data_planejada_fim >= ?`;
            planParams.push(data_inicio + ' 00:00:00');
        }
        if (data_fim) {
            planQuery += ` AND data_planejada_inicio <= ?`;
            planParams.push(data_fim + ' 23:59:59');
        }
        if (recurso) {
            planQuery += ` AND recurso_codigo LIKE ?`;
            planParams.push(`%${recurso.toUpperCase().trim()}%`);
        }

        const [planRows] = await mysqlPool.query(planQuery, planParams);
        console.log(`Fetched ${planRows.length} planning rows from MySQL in ${Date.now() - step1Start}ms`);

        if (planRows.length === 0) {
            console.log('No planned OPs in this range.');
            return;
        }

        // Extract distinct OP numbers
        const opNums = [...new Set(planRows.map(r => r.op_numero).filter(Boolean))];
        console.log(`Unique OPs to fetch: ${opNums.length}`);

        // 2. Query only these OPs from PostgreSQL
        const step2Start = Date.now();
        let pgWhere = `
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_quje < c2.c2_quant
              AND c2.c2_num = ANY($1)
        `;
        if (only_active === 'true') {
            pgWhere += ` AND (COALESCE(c5.c5_nota,'')='' OR EXISTS (
                SELECT 1 FROM public.sc6010 c6
                WHERE c6.c6_num=c5.c5_num AND c6.c6_filial=c5.c5_filial
                AND COALESCE(c6.d_e_l_e_t_,'')=''
                AND ((c6.c6_qtdven-c6.c6_qtdent)>0 OR c6.c6_qtdlib>0)))`;
        }

        const pgResult = await pgClient.query(`
            SELECT TRIM(c2.c2_num) AS op_num, TRIM(c2.c2_item) AS item_op,
                   TRIM(c2.c2_produto) AS produto, TRIM(c2.c2_pedido) AS pedido,
                   TRIM(c2.c2_itempv) AS item_pedido, c2.c2_quant AS qtde, c2.c2_quje AS qtde_feita,
                   TRIM(a1.a1_nome) AS cliente_nome
            FROM public.sc2010 c2
            LEFT JOIN public.sc5010 c5 ON TRIM(c5.c5_num)=TRIM(c2.c2_pedido) AND COALESCE(c5.d_e_l_e_t_,'') IN ('',' ')
            LEFT JOIN public.sa1010 a1 ON TRIM(a1.a1_cod)=TRIM(c5.c5_cliente) AND COALESCE(a1.d_e_l_e_t_,'') IN ('',' ')
            ${pgWhere}
        `, [opNums]);
        const opRows = pgResult.rows;
        console.log(`Fetched ${opRows.length} OPs from Postgres in ${Date.now() - step2Start}ms`);

        // 3. Routing only for products of these OPs
        const step3Start = Date.now();
        const distinctProds = [...new Set(opRows.map(r => r.produto).filter(Boolean))];
        let pgRoutingRows = [];
        if (distinctProds.length > 0) {
            const routingParams = [distinctProds];
            let routingFilter = '';
            if (recurso) {
                routingParams.push(`%${recurso.toUpperCase().trim()}%`);
                routingFilter = ` AND (TRIM(g2.g2_recurso) LIKE $2 OR UPPER(TRIM(h1.h1_descri)) LIKE $2)`;
            }
            const pgRouting = await pgClient.query(`
                SELECT TRIM(g2.g2_produto) prod, TRIM(g2.g2_operac) operac,
                       TRIM(g2.g2_recurso) recurso, g2.g2_tempad tempo,
                       TRIM(h1.h1_descri) recurso_descri
                FROM public.sg2010 g2
                LEFT JOIN public.sh1010 h1 ON TRIM(h1.h1_codigo)=TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_,'') IN ('',' ')
                WHERE TRIM(g2.g2_produto) = ANY($1)
                  AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                  ${routingFilter}
            `, routingParams);
            pgRoutingRows = pgRouting.rows;
        }
        console.log(`Fetched ${pgRoutingRows.length} routing rows in ${Date.now() - step3Start}ms`);
        console.log(`Total optimized way time: ${Date.now() - start}ms`);
    } catch (err) {
        console.error(err);
    } finally {
        if (pgClient) pgClient.release();
    }
}

async function run() {
    const data_inicio = '2026-06-01';
    const data_fim = '2026-06-30';
    const recurso = '';
    const only_active = 'true';

    console.log(`Running benchmarks for range: ${data_inicio} to ${data_fim}`);
    
    await testCurrentWay(data_inicio, data_fim, recurso, only_active);
    await testOptimizedWay(data_inicio, data_fim, recurso, only_active);
    
    process.exit(0);
}
run();
