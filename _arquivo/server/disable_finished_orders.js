require('dotenv').config();
const pg = require('./db');
const mysql = require('./services/mysqlService');

async function disableFinishedOrders() {
    console.log('Iniciando varredura de pedidos sem saldo a faturar...');
    try {
        const sql = `
            SELECT DISTINCT TRIM(c5.c5_num) AS pedido
            FROM public.sc5010 c5
            WHERE COALESCE(c5.d_e_l_e_t_, '') = '' 
              AND c5.c5_tipo <> 'B'
              AND NOT EXISTS (
                  SELECT 1 FROM public.sc6010 c6 
                  WHERE c6.c6_num = c5.c5_num 
                    AND c6.c6_filial = c5.c5_filial 
                    AND COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
              )
        `;

        const result = await pg.query(sql);
        const pedidos = result.rows.map(row => row.pedido).filter(Boolean);
        
        console.log(`Encontrados ${pedidos.length} pedidos sem saldo para faturar.`);

        if (pedidos.length > 0) {
            console.log('Inserindo no MySQL como inativos...');
            // Batch insert to avoid too many queries
            const CHUNK_SIZE = 500;
            let totalInserted = 0;

            for (let i = 0; i < pedidos.length; i += CHUNK_SIZE) {
                const chunk = pedidos.slice(i, i + CHUNK_SIZE);
                const values = chunk.map(p => `('${p}', 'AutoLimpeza')`).join(',');
                const query = `INSERT IGNORE INTO app_pedidos_inativos (pedido_numero, usuario) VALUES ${values}`;
                const [info] = await mysql.query(query);
                totalInserted += info.affectedRows;
            }

            console.log(`Foram adicionados ${totalInserted} novos pedidos inativos na tabela (ignorando os já existentes).`);
        }
        
    } catch (err) {
        console.error('Erro na execução:', err);
    } finally {
        process.exit();
    }
}

disableFinishedOrders();
