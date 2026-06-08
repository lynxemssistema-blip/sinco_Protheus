const mysql = require('mysql2/promise');

const TABLES_TO_INSPECT = [
    'app_pcp_historico_revisao',
    'app_planning_history',
    'app_pcp_delivery_forecasts',
    'app_demanda_vmi',
    'ordemservicoitem',
    'ordemservicoitem_processo',
    'app_sales_order_item_notes',
    'app_sales_order_item_notes_history',
    'app_faturamento_solicitacao_itens',
    'app_vmi_pedidos',
    'material',
    'material_processo',
    'app_romaneio_items',
    'app_faturamento_auditoria',
    'app_demanda_vmi_map',
    'app_engineering_releases',
    'app_engineering_timesheets',
    'nfe_auditoria_itens',
    'nfe_recebimento_itens',
    'sgq_assets',
    'hermes_chat_memory',
    'app_wabtec_escopos',
    'pcpmetal_conversas',
    'system_metrics',
    'app_conferencia_historico',
    'app_planning_lotes',
    'app_pcp_releases',
    'app_sgq_processos',
    'app_emails',
    'app_sales_notes',
    'blokset_schneider',
    'montapeca',
    'ordemservicoitemcontrole',
];

async function main() {
    const conn = await mysql.createConnection({
        host: 'metalfisa.mysql.uhserver.com',
        user: 'ronaldo2',
        password: 'jHAzhFG848@yN@U',
        database: 'metalfisa'
    });

    for (const table of TABLES_TO_INSPECT) {
        const [cols] = await conn.query(
            `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='metalfisa' AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
            [table]
        );
        console.log(`\n--- ${table} ---`);
        cols.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));
    }

    await conn.end();
}
main().catch(console.error);
