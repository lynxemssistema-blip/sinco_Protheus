require('dotenv').config();
const pg = require('./db');
const mysql = require('./services/mysqlService');

async function disableOldOrders() {
    console.log('Iniciando varredura de pedidos com data de entrega <= 2025...');
    try {
        const sql = `
            SELECT DISTINCT TRIM(c5.c5_num) AS pedido
            FROM public.sc5010 c5
            WHERE COALESCE(c5.d_e_l_e_t_, '') = '' 
              AND c5.c5_tipo <> 'B'
              AND EXISTS (
                  SELECT 1 FROM public.sc6010 c6 WHERE c6.c6_num = c5.c5_num AND c6.c6_filial = c5.c5_filial AND COALESCE(c6.d_e_l_e_t_, '') = ''
              )
              AND NOT EXISTS (
                  SELECT 1 FROM public.sc6010 c6 
                  WHERE c6.c6_num = c5.c5_num 
                    AND c6.c6_filial = c5.c5_filial 
                    AND COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND (TRIM(c6.c6_entreg) > '20251231' OR TRIM(c6.c6_entreg) = '')
              )
        `;

        const result = await pg.query(sql);
        const pedidos = result.rows.map(row => row.pedido).filter(Boolean);
        
        console.log(`Encontrados ${pedidos.length} pedidos com data de entrega <= 2025.`);

        if (pedidos.length > 0) {
            console.log('Inserindo no MySQL como inativos...');
            // Batch insert to avoid too many queries
            const CHUNK_SIZE = 500;
            let totalInserted = 0;

            for (let i = 0; i < pedidos.length; i += CHUNK_SIZE) {
                const chunk = pedidos.slice(i, i + CHUNK_SIZE);
                const values = chunk.map(p => `('${p}', 'AutoLimpeza_2025')`).join(',');
                const query = `INSERT IGNORE INTO app_pedidos_inativos (pedido_numero, usuario) VALUES ${values}`;
                const [info] = await mysql.query(query);
                totalInserted += info.affectedRows;
            }

            console.log(`Foram adicionados ${totalInserted} novos pedidos inativos da base antiga (ignorando os já ocultos).`);
        }
        
    } catch (err) {
        console.error('Erro na execução:', err);
    } finally {
        process.exit();
    }
}

disableOldOrders();
