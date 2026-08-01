require('dotenv').config();
/**
 * MetalFisa — Fase 2: Índices com nomes de colunas corrigidos via inspeção real do schema.
 */
const mysql = require('mysql2/promise');

const INDEXES = [
    // app_pcp_historico_revisao — 576k rows, 72MB, ZERO INDEXES ← CRÍTICO MÁXIMO
    { table: 'app_pcp_historico_revisao', name: 'idx_pcp_hist_f1', sql: null, inspect: true },

    // app_planning_history — 30k rows
    { table: 'app_planning_history', name: 'idx_planh_ts', sql: null, inspect: true },

    // app_pcp_delivery_forecasts — 20k rows
    { table: 'app_pcp_delivery_forecasts', name: 'idx_pcp_del_pedido', sql: null, inspect: true },

    // app_demanda_vmi — 3.3k rows
    { table: 'app_demanda_vmi', name: 'idx_vmi_dem', sql: null, inspect: true },

    // ordemservicoitem — 1.5k rows
    { table: 'ordemservicoitem', name: 'idx_ositem_os', sql: null, inspect: true },
    // ordemservicoitem_processo — 6k rows
    { table: 'ordemservicoitem_processo', name: 'idx_os_proc', sql: null, inspect: true },

    // app_sales_order_item_notes
    { table: 'app_sales_order_item_notes', name: 'idx_soin', sql: null, inspect: true },
    // app_sales_order_item_notes_history
    { table: 'app_sales_order_item_notes_history', name: 'idx_soinh', sql: null, inspect: true },

    // app_faturamento_solicitacao_itens
    { table: 'app_faturamento_solicitacao_itens', name: 'idx_fat_itens', sql: null, inspect: true },

    // material_processo — columns: IdMaterial, IdProcesso
    { table: 'material_processo', name: 'idx_matproc_idmat', sql: 'CREATE INDEX idx_matproc_idmat ON material_processo (IdMaterial)' },

    // app_romaneio_items — column: pedido
    { table: 'app_romaneio_items', name: 'idx_rom_items_ped', sql: 'CREATE INDEX idx_rom_items_ped ON app_romaneio_items (pedido)' },

    // app_faturamento_auditoria — column: solicitacao_id
    { table: 'app_faturamento_auditoria', name: 'idx_fat_aud_sol', sql: 'CREATE INDEX idx_fat_aud_sol ON app_faturamento_auditoria (solicitacao_id)' },

    // app_demanda_vmi_map — columns: codigo_produto_cliente, b1_cod
    { table: 'app_demanda_vmi_map', name: 'idx_vmi_map_cod', sql: 'CREATE INDEX idx_vmi_map_cod ON app_demanda_vmi_map (codigo_produto_cliente, b1_cod)' },

    // app_engineering_releases — columns: pedido, item, codigo_produto
    { table: 'app_engineering_releases', name: 'idx_eng_rel_pedido', sql: 'CREATE INDEX idx_eng_rel_pedido ON app_engineering_releases (pedido, item)' },
    { table: 'app_engineering_releases', name: 'idx_eng_rel_cod', sql: 'CREATE INDEX idx_eng_rel_cod ON app_engineering_releases (codigo_produto)' },
    { table: 'app_engineering_releases', name: 'idx_eng_rel_data', sql: 'CREATE INDEX idx_eng_rel_data ON app_engineering_releases (data_hora)' },

    // app_engineering_timesheets — columns: pedido, item, usuario
    { table: 'app_engineering_timesheets', name: 'idx_eng_ts_pedido', sql: 'CREATE INDEX idx_eng_ts_pedido ON app_engineering_timesheets (pedido, item)' },
    { table: 'app_engineering_timesheets', name: 'idx_eng_ts_usuario', sql: 'CREATE INDEX idx_eng_ts_usuario ON app_engineering_timesheets (usuario)' },

    // nfe_auditoria_itens — columns: id_auditoria, cprod_xml, status
    { table: 'nfe_auditoria_itens', name: 'idx_nfe_aud_id', sql: 'CREATE INDEX idx_nfe_aud_id ON nfe_auditoria_itens (id_auditoria, status)' },

    // nfe_recebimento_itens — columns: id_nfe, cProd, status
    { table: 'nfe_recebimento_itens', name: 'idx_nfe_rec_nfe', sql: 'CREATE INDEX idx_nfe_rec_nfe ON nfe_recebimento_itens (id_nfe, status)' },

    // sgq_assets — column: status (exists), requires_calibration
    { table: 'sgq_assets', name: 'idx_sgq_assets_cal', sql: 'CREATE INDEX idx_sgq_assets_cal ON sgq_assets (requires_calibration, calibration_validity)' },

    // hermes_chat_memory — columns: id_usuario, criado_em
    { table: 'hermes_chat_memory', name: 'idx_hermes_mem_user', sql: 'CREATE INDEX idx_hermes_mem_user ON hermes_chat_memory (id_usuario, criado_em)' },

    // app_wabtec_escopos — columns: status, projeto
    { table: 'app_wabtec_escopos', name: 'idx_wab_esc_status', sql: 'CREATE INDEX idx_wab_esc_status ON app_wabtec_escopos (status)' },
    { table: 'app_wabtec_escopos', name: 'idx_wab_esc_proj', sql: 'CREATE INDEX idx_wab_esc_proj ON app_wabtec_escopos (projeto)' },

    // pcpmetal_conversas — columns: id_usuario, criado_em
    { table: 'pcpmetal_conversas', name: 'idx_pcpm_conv_user', sql: 'CREATE INDEX idx_pcpm_conv_user ON pcpmetal_conversas (id_usuario, criado_em)' },

    // system_metrics — column: timestamp
    { table: 'system_metrics', name: 'idx_sys_met_ts', sql: 'CREATE INDEX idx_sys_met_ts ON system_metrics (timestamp)' },

    // app_conferencia_historico — columns: appointment_id, criado_em
    { table: 'app_conferencia_historico', name: 'idx_conf_hist_appt', sql: 'CREATE INDEX idx_conf_hist_appt ON app_conferencia_historico (appointment_id, criado_em)' },

    // app_planning_lotes — columns: lote_id (PK varchar), op_numero, criado_em
    { table: 'app_planning_lotes', name: 'idx_plan_lotes_op', sql: 'CREATE INDEX idx_plan_lotes_op ON app_planning_lotes (op_numero)' },
    { table: 'app_planning_lotes', name: 'idx_plan_lotes_em', sql: 'CREATE INDEX idx_plan_lotes_em ON app_planning_lotes (criado_em)' },

    // app_pcp_releases — columns: codigo_liberacao, data_hora, usuario
    { table: 'app_pcp_releases', name: 'idx_pcp_rel_cod', sql: 'CREATE INDEX idx_pcp_rel_cod ON app_pcp_releases (codigo_liberacao)' },
    { table: 'app_pcp_releases', name: 'idx_pcp_rel_dh', sql: 'CREATE INDEX idx_pcp_rel_dh ON app_pcp_releases (data_hora)' },

    // app_sgq_processos — columns: route_path, category
    { table: 'app_sgq_processos', name: 'idx_sgq_proc_route', sql: 'CREATE INDEX idx_sgq_proc_route ON app_sgq_processos (route_path)' },
    { table: 'app_sgq_processos', name: 'idx_sgq_proc_cat', sql: 'CREATE INDEX idx_sgq_proc_cat ON app_sgq_processos (category)' },

    // app_emails — columns: folder, read_status, date, uid
    { table: 'app_emails', name: 'idx_emails_uid', sql: 'CREATE INDEX idx_emails_uid ON app_emails (uid)' },
    { table: 'app_emails', name: 'idx_emails_folder', sql: 'CREATE INDEX idx_emails_folder ON app_emails (folder, read_status, date)' },
    { table: 'app_emails', name: 'idx_emails_msgid', sql: 'CREATE INDEX idx_emails_msgid ON app_emails (message_id)' },

    // app_sales_notes — columns: order_number, item_number
    { table: 'app_sales_notes', name: 'idx_sales_notes_ord', sql: 'CREATE INDEX idx_sales_notes_ord ON app_sales_notes (order_number, item_number)' },
    { table: 'app_sales_notes', name: 'idx_sales_notes_res', sql: 'CREATE INDEX idx_sales_notes_res ON app_sales_notes (is_resolved)' },

    // blokset_schneider — column: ImportacaoId, DataImportacao
    { table: 'blokset_schneider', name: 'idx_blok_import', sql: 'CREATE INDEX idx_blok_import ON blokset_schneider (ImportacaoId, DataImportacao)' },

    // montapeca — columns: IdMaterial, IdMaterialPeca, D_E_L_E_T_E
    { table: 'montapeca', name: 'idx_montap_mat', sql: 'CREATE INDEX idx_montap_mat ON montapeca (IdMaterial, D_E_L_E_T_E)' },
    { table: 'montapeca', name: 'idx_montap_peca', sql: 'CREATE INDEX idx_montap_peca ON montapeca (IdMaterialPeca)' },

    // ordemservicoitemcontrole — columns: IdOrdemServico, IdOrdemServicoItem, D_E_L_E_T_E
    { table: 'ordemservicoitemcontrole', name: 'idx_osic_os', sql: 'CREATE INDEX idx_osic_os ON ordemservicoitemcontrole (IdOrdemServico, D_E_L_E_T_E)' },
    { table: 'ordemservicoitemcontrole', name: 'idx_osic_item', sql: 'CREATE INDEX idx_osic_item ON ordemservicoitemcontrole (IdOrdemServicoItem)' },
];

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    // Fetch all existing indexes once
    const [existingRows] = await conn.query(`
        SELECT CONCAT(TABLE_NAME, '||', INDEX_NAME) AS key_val
        FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'metalfisa'
    `);
    const existingKeys = new Set(existingRows.map(r => r.key_val));

    // Inspect dynamic tables
    const INSPECTIONS = {
        'app_pcp_historico_revisao': null,
        'app_planning_history': null,
        'app_pcp_delivery_forecasts': null,
        'app_demanda_vmi': null,
        'ordemservicoitem': null,
        'ordemservicoitem_processo': null,
        'app_sales_order_item_notes': null,
        'app_sales_order_item_notes_history': null,
        'app_faturamento_solicitacao_itens': null,
    };
    for (const tbl of Object.keys(INSPECTIONS)) {
        const [cols] = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='metalfisa' AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
            [tbl]
        );
        INSPECTIONS[tbl] = cols.map(c => c.COLUMN_NAME);
        console.log(`Schema ${tbl}: ${INSPECTIONS[tbl].join(', ')}`);
    }

    // Build dynamic index SQLs
    const dynamicIndexes = [];

    // app_pcp_historico_revisao — 576k rows, 72MB, NO INDEX
    const histCols = INSPECTIONS['app_pcp_historico_revisao'];
    if (histCols.includes('op') && histCols.includes('op_item')) {
        dynamicIndexes.push({ table: 'app_pcp_historico_revisao', name: 'idx_pcp_hist_op', sql: 'CREATE INDEX idx_pcp_hist_op ON app_pcp_historico_revisao (op, op_item)' });
    } else if (histCols.includes('op_numero') && histCols.includes('item')) {
        dynamicIndexes.push({ table: 'app_pcp_historico_revisao', name: 'idx_pcp_hist_op', sql: 'CREATE INDEX idx_pcp_hist_op ON app_pcp_historico_revisao (op_numero, item)' });
    }
    const histDateCol = histCols.find(c => ['created_at','data_revisao','timestamp','data_hora','criado_em'].includes(c));
    if (histDateCol) dynamicIndexes.push({ table: 'app_pcp_historico_revisao', name: 'idx_pcp_hist_date', sql: `CREATE INDEX idx_pcp_hist_date ON app_pcp_historico_revisao (${histDateCol})` });

    // app_planning_history
    const planHCols = INSPECTIONS['app_planning_history'];
    const planHDateCol = planHCols.find(c => ['created_at','timestamp','data_hora','criado_em'].includes(c));
    if (planHDateCol) dynamicIndexes.push({ table: 'app_planning_history', name: 'idx_planh_date', sql: `CREATE INDEX idx_planh_date ON app_planning_history (${planHDateCol})` });

    // app_pcp_delivery_forecasts
    const delCols = INSPECTIONS['app_pcp_delivery_forecasts'];
    const delOpCol = delCols.find(c => ['op_numero','op','numero_op'].includes(c));
    if (delOpCol) dynamicIndexes.push({ table: 'app_pcp_delivery_forecasts', name: 'idx_pcp_del_op', sql: `CREATE INDEX idx_pcp_del_op ON app_pcp_delivery_forecasts (${delOpCol})` });

    // app_demanda_vmi
    const demCols = INSPECTIONS['app_demanda_vmi'];
    const demLoteCol = demCols.find(c => ['leitura_id','lote_id','import_id'].includes(c));
    if (demLoteCol) dynamicIndexes.push({ table: 'app_demanda_vmi', name: 'idx_vmi_dem_lote', sql: `CREATE INDEX idx_vmi_dem_lote ON app_demanda_vmi (${demLoteCol})` });

    // ordemservicoitem
    const osiCols = INSPECTIONS['ordemservicoitem'];
    const osiOsCol = osiCols.find(c => ['IdOrdemServico','os_id','ordem_id'].includes(c));
    if (osiOsCol) dynamicIndexes.push({ table: 'ordemservicoitem', name: 'idx_ositem_os', sql: `CREATE INDEX idx_ositem_os ON ordemservicoitem (${osiOsCol})` });
    const osiDelCol = osiCols.find(c => c === 'D_E_L_E_T_E' || c === 'deletado');
    if (osiDelCol && osiOsCol) dynamicIndexes.push({ table: 'ordemservicoitem', name: 'idx_ositem_del', sql: `CREATE INDEX idx_ositem_del ON ordemservicoitem (${osiOsCol}, ${osiDelCol})` });

    // ordemservicoitem_processo
    const osipCols = INSPECTIONS['ordemservicoitem_processo'];
    const osipItemCol = osipCols.find(c => ['IdOrdemServicoItem','os_item_id'].includes(c));
    if (osipItemCol) dynamicIndexes.push({ table: 'ordemservicoitem_processo', name: 'idx_os_proc_item', sql: `CREATE INDEX idx_os_proc_item ON ordemservicoitem_processo (${osipItemCol})` });

    // app_sales_order_item_notes
    const soinCols = INSPECTIONS['app_sales_order_item_notes'];
    const soinPedCol = soinCols.find(c => ['pedido_numero','pedido','order_number'].includes(c));
    if (soinPedCol) dynamicIndexes.push({ table: 'app_sales_order_item_notes', name: 'idx_soin_pedido', sql: `CREATE INDEX idx_soin_pedido ON app_sales_order_item_notes (${soinPedCol})` });

    // app_sales_order_item_notes_history
    const soinhCols = INSPECTIONS['app_sales_order_item_notes_history'];
    console.log('SOINH cols:', soinhCols);
    const soinhNoteCol = soinhCols.find(c => ['note_id','soin_id','item_note_id'].includes(c));
    if (soinhNoteCol) dynamicIndexes.push({ table: 'app_sales_order_item_notes_history', name: 'idx_soinh_note', sql: `CREATE INDEX idx_soinh_note ON app_sales_order_item_notes_history (${soinhNoteCol})` });

    // app_faturamento_solicitacao_itens
    const fatCols = INSPECTIONS['app_faturamento_solicitacao_itens'];
    console.log('Fat itens cols:', fatCols);
    const fatPedCol = fatCols.find(c => ['pedido_numero','pedido','c5_num'].includes(c));
    if (fatPedCol) dynamicIndexes.push({ table: 'app_faturamento_solicitacao_itens', name: 'idx_fat_itens_ped', sql: `CREATE INDEX idx_fat_itens_ped ON app_faturamento_solicitacao_itens (${fatPedCol})` });

    const allIndexes = [...INDEXES.filter(i => i.sql !== null), ...dynamicIndexes];

    const results = { created: [], skipped: [], errors: [] };

    for (const idx of allIndexes) {
        const key = `${idx.table}||${idx.name}`;
        if (existingKeys.has(key)) {
            results.skipped.push(idx.name);
            continue;
        }
        try {
            const t0 = Date.now();
            await conn.query(idx.sql);
            const ms = Date.now() - t0;
            results.created.push({ name: idx.name, table: idx.table, ms });
            console.log(`  ✅ CREATED [${ms}ms]: ${idx.name} ON ${idx.table}`);
        } catch (err) {
            results.errors.push({ name: idx.name, error: err.message });
            console.log(`  ❌ ERROR: ${idx.name} — ${err.message}`);
        }
    }

    await conn.end();

    console.log('\n==============================');
    console.log(`RESULTS: ${results.created.length} created | ${results.skipped.length} skipped | ${results.errors.length} errors`);
    if (results.errors.length > 0) {
        console.log('REMAINING ERRORS:');
        results.errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
    }
}

main().catch(console.error);
