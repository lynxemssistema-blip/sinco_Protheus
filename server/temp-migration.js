require('dotenv').config();
const mysqlPool = require('./services/mysqlService');
const pgPool = require('./db');

async function run() {
    try {

        try { await mysqlPool.query("ALTER TABLE app_faturamento_solicitacao_itens ADD COLUMN pedido_cliente VARCHAR(100) NULL"); } catch(e){}
        try { await mysqlPool.query("ALTER TABLE app_faturamento_solicitacao_itens ADD COLUMN desenho_cliente VARCHAR(100) NULL"); } catch(e){}
        try { await mysqlPool.query("ALTER TABLE app_faturamento_solicitacao_itens ADD COLUMN cliente_nome VARCHAR(255) NULL"); } catch(e){}

        const [rows] = await mysqlPool.query("SELECT id, pedido, item, codigo_produto FROM app_faturamento_solicitacao_itens WHERE pedido_cliente IS NULL OR desenho_cliente IS NULL OR cliente_nome IS NULL");
        
        console.log(`Buscando ${rows.length} itens nulos...`);
        let updatedCount = 0;

        for (const r of rows) {
            const { rows: pgRow } = await pgPool.query(`
                SELECT TRIM(c6.c6_pedcli) as ped_cliente, TRIM(sa1.a1_nome) as nome_cliente 
                FROM public.sc6010 c6 
                JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial
                LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli
                WHERE TRIM(c6.c6_num) = $1 AND TRIM(c6.c6_item) = $2
            `, [String(r.pedido).trim(), String(r.item).padStart(2, '0')]);
            
            const { rows: zgRow } = await pgPool.query("SELECT STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ') as ref_cliente FROM public.sz1010 z1 WHERE TRIM(z1.z1_produto) = $1 AND COALESCE(z1.d_e_l_e_t_, '') = ''", [String(r.codigo_produto).trim()]);
            
            const pCli = pgRow.length > 0 && pgRow[0].ped_cliente ? pgRow[0].ped_cliente.trim() : '';
            const nCli = pgRow.length > 0 && pgRow[0].nome_cliente ? pgRow[0].nome_cliente.trim() : '';
            const rCli = zgRow.length > 0 && zgRow[0].ref_cliente ? zgRow[0].ref_cliente.trim() : '';
            
            await mysqlPool.query("UPDATE app_faturamento_solicitacao_itens SET pedido_cliente = ?, desenho_cliente = ?, cliente_nome = ? WHERE id = ?", [pCli, rCli, nCli, r.id]);
            updatedCount++;
        }
        console.log(`Migração concluída. Atualizados ${updatedCount} registros.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
