require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('../services/mysqlService');

async function fixTotals() {
    try {
        console.log('Iniciando recalculo de valor_total para pedidos de venda...');
        
        // 1. Atualizar pedidos cujo valor_total seja 0 ou nulo
        const sql = `
            UPDATE erp_pedidos_venda p
            JOIN (
                SELECT pedido_numero, SUM(COALESCE(NULLIF(valor_total, 0), quantidade * preco_unitario)) as total_itens
                FROM erp_pedidos_itens
                GROUP BY pedido_numero
            ) it ON p.numero_pedido = it.pedido_numero
            SET p.valor_total = it.total_itens
            WHERE p.valor_total = 0 OR p.valor_total IS NULL
        `;

        const [result] = await mysql.query(sql);
        console.log('Linhas atualizadas:', result.affectedRows);

        // 2. Testar pedido 004618
        const [p] = await mysql.query('SELECT numero_pedido, valor_total FROM erp_pedidos_venda WHERE numero_pedido = "004618"');
        console.log('Pedido 004618 atualizado:', p);

        // 3. Estatísticas gerais
        const [stats] = await mysql.query(`
            SELECT 
                COUNT(*) as total_pedidos,
                SUM(CASE WHEN valor_total > 0 THEN 1 ELSE 0 END) as com_valor,
                SUM(CASE WHEN valor_total = 0 OR valor_total IS NULL THEN 1 ELSE 0 END) as zerados,
                SUM(valor_total) as valor_total_geral
            FROM erp_pedidos_venda
        `);
        console.log('Estatisticas finais:', stats[0]);

        process.exit(0);
    } catch (err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

fixTotals();
