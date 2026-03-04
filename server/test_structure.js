require('dotenv').config();
const pool = require('./services/mysqlService');

async function test() {
    try {
        // 1. Listar alguns produtos principais
        const [principais] = await pool.query(`
            SELECT DISTINCT CodMatFabricante, IdOrdemServico 
            FROM ordemservicoitem 
            WHERE ProdutoPrincipal = 'SIM' 
            LIMIT 5
        `);
        console.log('--- Exemplos de Produtos Principais ---');
        console.table(principais);

        if (principais.length > 0) {
            const cod = principais[0].CodMatFabricante;
            console.log(`\n--- Testando estrutura para: ${cod} ---`);

            // Query original da rota
            const [osRows] = await pool.execute(
                `SELECT i.IdOrdemServico
                FROM ordemservicoitem i
                WHERE i.CodMatFabricante = ? AND i.ProdutoPrincipal = 'SIM'
                ORDER BY CAST(i.IdOrdemServico AS UNSIGNED) DESC
                LIMIT 1`,
                [cod]
            );

            if (osRows.length > 0) {
                const idOS = osRows[0].IdOrdemServico;
                console.log(`Última OS encontrada: ${idOS}`);

                const [items] = await pool.execute(
                    `SELECT i.Nivel, i.CodMatFabricante, i.DescResumo
                    FROM ordemservicoitem i
                    WHERE i.IdOrdemServico = ?
                      AND (i.ProdutoPrincipal IS NULL OR i.ProdutoPrincipal != 'SIM')
                    ORDER BY i.Nivel ASC, i.IdOrdemServicoItem ASC
                    LIMIT 5`,
                    [idOS]
                );
                console.log('Itens encontrados:', items.length);
                console.table(items);
            } else {
                console.log('Nenhuma OS encontrada para este produto.');
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

test();
