/**
 * MetalFisa Antigravity — Master Index Creation Script
 * Cria/valida TODOS os índices necessários com base na análise completa das rotas.
 * Seguro: verifica existence antes de criar. Não derruba índices existentes.
 */

const mysql = require('mysql2/promise');

const INDEXES = [
    // ─────────────────────────────────────────────────────────────
    // CRÍTICOS: Tabelas grandes com queries frequentes
    // ─────────────────────────────────────────────────────────────

    // app_pcp_historico_revisao — 576k rows, 72MB, INDEX_MB = 0 ← PERIGO
    { table: 'app_pcp_historico_revisao', name: 'idx_pcp_hist_op',       sql: 'CREATE INDEX idx_pcp_hist_op       ON app_pcp_historico_revisao (op_numero, op_item)' },
    { table: 'app_pcp_historico_revisao', name: 'idx_pcp_hist_data',     sql: 'CREATE INDEX idx_pcp_hist_data     ON app_pcp_historico_revisao (created_at)' },

    // app_production_planning — 141k rows, já indexado, mas falta índice composto op+operacao
    { table: 'app_production_planning', name: 'idx_plan_full_key',       sql: 'CREATE INDEX idx_plan_full_key     ON app_production_planning (op_numero, op_item, op_sequencia, operacao_codigo)' },
    { table: 'app_production_planning', name: 'idx_plan_op_item',        sql: 'CREATE INDEX idx_plan_op_item      ON app_production_planning (op_numero, op_item)' },
    { table: 'app_production_planning', name: 'idx_plan_datas',          sql: 'CREATE INDEX idx_plan_datas        ON app_production_planning (data_planejada_inicio, data_planejada_fim)' },

    // app_production_appointments — 36k rows, 3.5MB
    { table: 'app_production_appointments', name: 'idx_appt_op_key',     sql: 'CREATE INDEX idx_appt_op_key      ON app_production_appointments (op_numero, op_item, operacao_codigo)' },
    { table: 'app_production_appointments', name: 'idx_appt_data_fim',   sql: 'CREATE INDEX idx_appt_data_fim    ON app_production_appointments (data_fim)' },
    { table: 'app_production_appointments', name: 'idx_appt_usuario',    sql: 'CREATE INDEX idx_appt_usuario     ON app_production_appointments (usuario)' },

    // app_wabtec_imported_rows — 7.9k rows, cross-join com sc6010
    { table: 'app_wabtec_imported_rows', name: 'idx_wab_import_id',      sql: 'CREATE INDEX idx_wab_import_id    ON app_wabtec_imported_rows (import_id)' },
    { table: 'app_wabtec_imported_rows', name: 'idx_wab_pedido',         sql: 'CREATE INDEX idx_wab_pedido       ON app_wabtec_imported_rows (pedido_metal, cod_produto)' },
    { table: 'app_wabtec_imported_rows', name: 'idx_wab_po',             sql: 'CREATE INDEX idx_wab_po           ON app_wabtec_imported_rows (po_number)' },

    // produtos_docs — 30k rows, 5.5MB, INDEX = 0 ← FULL SCAN em toda busca
    { table: 'produtos_docs', name: 'idx_pdocs_codigo',                   sql: 'CREATE INDEX idx_pdocs_codigo     ON produtos_docs (produto_codigo)' },
    { table: 'produtos_docs', name: 'idx_pdocs_produto',                  sql: 'CREATE INDEX idx_pdocs_produto    ON produtos_docs (produto_codigo(20))' },

    // app_planning_history — 30k rows, 5.5MB
    { table: 'app_planning_history', name: 'idx_planh_op',               sql: 'CREATE INDEX idx_planh_op         ON app_planning_history (op_numero, op_item)' },
    { table: 'app_planning_history', name: 'idx_planh_created',          sql: 'CREATE INDEX idx_planh_created    ON app_planning_history (created_at)' },

    // ─────────────────────────────────────────────────────────────
    // ALTOS: Tabelas médias, queries frequentes de UI
    // ─────────────────────────────────────────────────────────────

    // app_pcp_delivery_forecasts — 20k rows, buscado em visao-geral
    { table: 'app_pcp_delivery_forecasts', name: 'idx_pcp_del_pedido',   sql: 'CREATE INDEX idx_pcp_del_pedido   ON app_pcp_delivery_forecasts (pedido, item)' },
    { table: 'app_pcp_delivery_forecasts', name: 'idx_pcp_del_op',       sql: 'CREATE INDEX idx_pcp_del_op       ON app_pcp_delivery_forecasts (op_numero)' },

    // app_demanda_vmi — 3.3k rows
    { table: 'app_demanda_vmi', name: 'idx_vmi_dem_item',                sql: 'CREATE INDEX idx_vmi_dem_item     ON app_demanda_vmi (item_cliente, leitura_id)' },

    // ordemservicoitem — 1.5k rows, usado no SINCO
    { table: 'ordemservicoitem', name: 'idx_os_item_os',                  sql: 'CREATE INDEX idx_os_item_os       ON ordemservicoitem (os_id)' },
    { table: 'ordemservicoitem', name: 'idx_os_item_status',              sql: 'CREATE INDEX idx_os_item_status   ON ordemservicoitem (status)' },

    // ordemservicoitem_processo — 6k rows, sem index
    { table: 'ordemservicoitem_processo', name: 'idx_os_proc_item',       sql: 'CREATE INDEX idx_os_proc_item     ON ordemservicoitem_processo (os_item_id)' },

    // app_sales_order_item_notes — 454 rows
    { table: 'app_sales_order_item_notes', name: 'idx_soin_pedido',       sql: 'CREATE INDEX idx_soin_pedido      ON app_sales_order_item_notes (pedido_numero, item_numero)' },

    // app_sales_order_item_notes_history — 2568 rows
    { table: 'app_sales_order_item_notes_history', name: 'idx_soinh_note', sql: 'CREATE INDEX idx_soinh_note     ON app_sales_order_item_notes_history (note_id)' },
    { table: 'app_sales_order_item_notes_history', name: 'idx_soinh_created', sql: 'CREATE INDEX idx_soinh_created ON app_sales_order_item_notes_history (created_at)' },

    // sistema_avisos — polling a cada 30s (já criado, mas adicionando remetente)
    { table: 'sistema_avisos', name: 'idx_avisos_dest_concl',             sql: 'CREATE INDEX idx_avisos_dest_concl ON sistema_avisos (idDestinatario, concluido, data_envio)' },
    { table: 'sistema_avisos', name: 'idx_avisos_remetente',              sql: 'CREATE INDEX idx_avisos_remetente  ON sistema_avisos (idRemetente)' },

    // app_user_permissions — carregado em todo page load
    { table: 'app_user_permissions', name: 'idx_user_perms_user',         sql: 'CREATE INDEX idx_user_perms_user   ON app_user_permissions (user_id)' },
    { table: 'app_user_permissions', name: 'idx_user_perms_page',         sql: 'CREATE INDEX idx_user_perms_page   ON app_user_permissions (page_id)' },

    // usuario — login é a chave de autenticação
    { table: 'usuario', name: 'idx_usuario_login',                        sql: 'CREATE INDEX idx_usuario_login     ON usuario (Login)' },
    { table: 'usuario', name: 'idx_usuario_tipo',                         sql: 'CREATE INDEX idx_usuario_tipo      ON usuario (TipoUsuario, aprovado)' },

    // ─────────────────────────────────────────────────────────────
    // MÉDIOS: Tabelas de suporte, queries pontuais
    // ─────────────────────────────────────────────────────────────

    // app_faturamento_solicitacao_itens — 1.5k rows
    { table: 'app_faturamento_solicitacao_itens', name: 'idx_fat_itens_sol', sql: 'CREATE INDEX idx_fat_itens_sol ON app_faturamento_solicitacao_itens (solicitacao_id)' },
    { table: 'app_faturamento_solicitacao_itens', name: 'idx_fat_itens_pedido', sql: 'CREATE INDEX idx_fat_itens_pedido ON app_faturamento_solicitacao_itens (pedido_numero, item_numero)' },

    // app_vmi_pedidos — 1.6k rows
    { table: 'app_vmi_pedidos', name: 'idx_vmi_ped_status',              sql: 'CREATE INDEX idx_vmi_ped_status    ON app_vmi_pedidos (status)' },
    { table: 'app_vmi_pedidos', name: 'idx_vmi_ped_cliente',             sql: 'CREATE INDEX idx_vmi_ped_cliente   ON app_vmi_pedidos (cliente_codigo)' },

    // material — 18k rows, 4.5MB
    { table: 'material', name: 'idx_material_codigo',                     sql: 'CREATE INDEX idx_material_codigo   ON material (codigo)' },

    // material_processo — 1.3k rows, sem index
    { table: 'material_processo', name: 'idx_matproc_mat',               sql: 'CREATE INDEX idx_matproc_mat       ON material_processo (material_id)' },

    // app_romaneio_items — 1.3k rows
    { table: 'app_romaneio_items', name: 'idx_rom_items_rom',            sql: 'CREATE INDEX idx_rom_items_rom     ON app_romaneio_items (romaneio_id)' },
    { table: 'app_romaneio_items', name: 'idx_rom_items_pedido',         sql: 'CREATE INDEX idx_rom_items_pedido  ON app_romaneio_items (pedido_numero)' },

    // app_romaneio_recebimentos — 257 rows
    { table: 'app_romaneio_recebimentos', name: 'idx_rom_receb_rom',     sql: 'CREATE INDEX idx_rom_receb_rom     ON app_romaneio_recebimentos (romaneio_id)' },

    // app_faturamento_auditoria — 566 rows
    { table: 'app_faturamento_auditoria', name: 'idx_fat_aud_pedido',    sql: 'CREATE INDEX idx_fat_aud_pedido    ON app_faturamento_auditoria (pedido_numero)' },

    // app_faturamento_solicitacoes — 236 rows
    { table: 'app_faturamento_solicitacoes', name: 'idx_fat_sol_status', sql: 'CREATE INDEX idx_fat_sol_status    ON app_faturamento_solicitacoes (status, created_at)' },

    // vmi_itens — 802 rows
    { table: 'vmi_itens', name: 'idx_vmi_itens_leitura',                 sql: 'CREATE INDEX idx_vmi_itens_leitura ON vmi_itens (leitura_id)' },

    // vmi_itens_pedidos — 1k rows
    { table: 'vmi_itens_pedidos', name: 'idx_vmi_itp_item',              sql: 'CREATE INDEX idx_vmi_itp_item      ON vmi_itens_pedidos (item_id)' },

    // app_demanda_vmi_map — 1.3k rows
    { table: 'app_demanda_vmi_map', name: 'idx_vmi_map_cod',             sql: 'CREATE INDEX idx_vmi_map_cod       ON app_demanda_vmi_map (codigo_cliente, codigo_metalfisa)' },

    // app_engineering_releases — 236 rows
    { table: 'app_engineering_releases', name: 'idx_eng_rel_op',         sql: 'CREATE INDEX idx_eng_rel_op        ON app_engineering_releases (op_numero, op_item)' },
    { table: 'app_engineering_releases', name: 'idx_eng_rel_status',     sql: 'CREATE INDEX idx_eng_rel_status    ON app_engineering_releases (status)' },

    // app_engineering_timesheets — 20 rows
    { table: 'app_engineering_timesheets', name: 'idx_eng_ts_pedido',    sql: 'CREATE INDEX idx_eng_ts_pedido     ON app_engineering_timesheets (pedido_numero)' },

    // app_audit_logs — 245 rows, sem index
    { table: 'app_audit_logs', name: 'idx_audit_user',                   sql: 'CREATE INDEX idx_audit_user        ON app_audit_logs (user_id, created_at)' },

    // app_pedidos_inativos — 2.5k rows, sem index — buscado em TODO request PCP
    { table: 'app_pedidos_inativos', name: 'idx_ped_inat_num',           sql: 'CREATE INDEX idx_ped_inat_num      ON app_pedidos_inativos (pedido_numero)' },

    // app_settings — 1 row, sem index (baixa prioridade, mas corretude)
    { table: 'app_settings', name: 'idx_settings_key',                   sql: 'CREATE INDEX idx_settings_key      ON app_settings (setting_key)' },

    // nfe_auditoria_itens — 672 rows
    { table: 'nfe_auditoria_itens', name: 'idx_nfe_aud_num',             sql: 'CREATE INDEX idx_nfe_aud_num       ON nfe_auditoria_itens (nfe_numero)' },

    // nfe_recebimento_itens — 61 rows
    { table: 'nfe_recebimento_itens', name: 'idx_nfe_rec_itens',         sql: 'CREATE INDEX idx_nfe_rec_itens     ON nfe_recebimento_itens (recebimento_id)' },

    // sgq_assets — 333 rows
    { table: 'sgq_assets', name: 'idx_sgq_assets_status',               sql: 'CREATE INDEX idx_sgq_assets_status  ON sgq_assets (status)' },
    { table: 'sgq_assets', name: 'idx_sgq_assets_tipo',                 sql: 'CREATE INDEX idx_sgq_assets_tipo     ON sgq_assets (tipo)' },

    // sgq_calibrations — 39 rows
    { table: 'sgq_calibrations', name: 'idx_sgq_cal_asset',             sql: 'CREATE INDEX idx_sgq_cal_asset       ON sgq_calibrations (asset_id)' },

    // pcp_setor_recursos — 88 rows, joinado em toda taxa-ocupacao
    { table: 'pcp_setor_recursos', name: 'idx_pcp_setr_rec',            sql: 'CREATE INDEX idx_pcp_setr_rec        ON pcp_setor_recursos (recurso_codigo)' },
    { table: 'pcp_setor_recursos', name: 'idx_pcp_setr_setor',          sql: 'CREATE INDEX idx_pcp_setr_setor      ON pcp_setor_recursos (setor_id)' },

    // app_pcp_snapshots — 0 rows mas precisa de index para futura crescimento
    { table: 'app_pcp_snapshots', name: 'idx_pcp_snap_date',            sql: 'CREATE INDEX idx_pcp_snap_date       ON app_pcp_snapshots (snapshot_date)' },

    // hermes_chat_memory — 24 rows
    { table: 'hermes_chat_memory', name: 'idx_hermes_mem_session',      sql: 'CREATE INDEX idx_hermes_mem_session  ON hermes_chat_memory (session_id)' },

    // app_wabtec_escopos
    { table: 'app_wabtec_escopos', name: 'idx_wab_esc_po',              sql: 'CREATE INDEX idx_wab_esc_po          ON app_wabtec_escopos (po_number)' },

    // app_wabtec_bom — 1.2k rows
    { table: 'app_wabtec_bom', name: 'idx_wab_bom_lote',               sql: 'CREATE INDEX idx_wab_bom_lote         ON app_wabtec_bom (lote_id)' },

    // app_wabtec_estruturas — 257 rows
    { table: 'app_wabtec_estruturas', name: 'idx_wab_est_lote',         sql: 'CREATE INDEX idx_wab_est_lote        ON app_wabtec_estruturas (lote_id)' },

    // pcpmetal_conversas
    { table: 'pcpmetal_conversas', name: 'idx_pcpm_conv_user',          sql: 'CREATE INDEX idx_pcpm_conv_user       ON pcpmetal_conversas (user_id)' },

    // app_estoque_movimentos — 8 rows
    { table: 'app_estoque_movimentos', name: 'idx_estq_mov_produto',    sql: 'CREATE INDEX idx_estq_mov_produto     ON app_estoque_movimentos (produto_codigo)' },

    // system_metrics — 1k rows, sem index
    { table: 'system_metrics', name: 'idx_sys_met_created',             sql: 'CREATE INDEX idx_sys_met_created      ON system_metrics (created_at)' },

    // app_romaneios_nfs
    { table: 'app_romaneios_nfs', name: 'idx_rom_nfs_rom',              sql: 'CREATE INDEX idx_rom_nfs_rom          ON app_romaneios_nfs (romaneio_id)' },

    // app_conferencia_historico — 19 rows
    { table: 'app_conferencia_historico', name: 'idx_conf_hist_op',     sql: 'CREATE INDEX idx_conf_hist_op         ON app_conferencia_historico (op_numero)' },

    // app_planning_lotes — 122 rows
    { table: 'app_planning_lotes', name: 'idx_plan_lotes_status',       sql: 'CREATE INDEX idx_plan_lotes_status    ON app_planning_lotes (status)' },

    // app_pcp_releases — 2 rows
    { table: 'app_pcp_releases', name: 'idx_pcp_rel_op',               sql: 'CREATE INDEX idx_pcp_rel_op           ON app_pcp_releases (op_numero, op_item)' },

    // app_system_errors — 175 rows
    { table: 'app_system_errors', name: 'idx_syserr_created',           sql: 'CREATE INDEX idx_syserr_created       ON app_system_errors (created_at)' },

    // app_sgq_rnc_apontamentos — 8 rows
    { table: 'app_sgq_rnc_apontamentos', name: 'idx_rnc_apont_rnc',    sql: 'CREATE INDEX idx_rnc_apont_rnc        ON app_sgq_rnc_apontamentos (rnc_id)' },

    // app_sgq_processos — 104 rows
    { table: 'app_sgq_processos', name: 'idx_sgq_proc_setor',           sql: 'CREATE INDEX idx_sgq_proc_setor       ON app_sgq_processos (setor)' },

    // app_emails — 1.8k rows, 9.5MB (blobs)
    { table: 'app_emails', name: 'idx_emails_status',                   sql: 'CREATE INDEX idx_emails_status        ON app_emails (status, created_at)' },
    { table: 'app_emails', name: 'idx_emails_ref',                      sql: 'CREATE INDEX idx_emails_ref           ON app_emails (reference_id, reference_type)' },

    // app_romaneio_revisions — 9 rows
    { table: 'app_romaneio_revisions', name: 'idx_rom_rev_rom',         sql: 'CREATE INDEX idx_rom_rev_rom          ON app_romaneio_revisions (romaneio_id)' },

    // winscp_logs — 2 rows
    { table: 'winscp_logs', name: 'idx_winscp_logs_conn',               sql: 'CREATE INDEX idx_winscp_logs_conn     ON winscp_logs (connection_id)' },

    // app_sales_notes — 35 rows
    { table: 'app_sales_notes', name: 'idx_sales_notes_pedido',         sql: 'CREATE INDEX idx_sales_notes_pedido   ON app_sales_notes (pedido_numero)' },

    // blokset_schneider — 5.7k rows, sem index
    { table: 'blokset_schneider', name: 'idx_blok_sch_codigo',          sql: 'CREATE INDEX idx_blok_sch_codigo      ON blokset_schneider (codigo)' },

    // montapeca — 714 rows, sem index
    { table: 'montapeca', name: 'idx_montap_material',                  sql: 'CREATE INDEX idx_montap_material      ON montapeca (material_id)' },

    // ordemservicoitemcontrole — 385 rows, sem index
    { table: 'ordemservicoitemcontrole', name: 'idx_osic_item',         sql: 'CREATE INDEX idx_osic_item            ON ordemservicoitemcontrole (os_item_id)' },
];

async function main() {
    const conn = await mysql.createConnection({
        host: 'metalfisa.mysql.uhserver.com',
        user: 'ronaldo2',
        password: 'jHAzhFG848@yN@U',
        database: 'metalfisa'
    });

    console.log('🔍 Fetching existing indexes...');
    const [existingRows] = await conn.query(`
        SELECT CONCAT(TABLE_NAME, '||', INDEX_NAME) AS key_val
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = 'metalfisa'
    `);
    const existingKeys = new Set(existingRows.map(r => r.key_val));

    const results = { created: [], skipped: [], errors: [] };

    for (const idx of INDEXES) {
        const key = `${idx.table}||${idx.name}`;
        if (existingKeys.has(key)) {
            results.skipped.push(idx.name);
            process.stdout.write(`  ⏭️  SKIP: ${idx.name}\n`);
            continue;
        }
        try {
            const t0 = Date.now();
            await conn.query(idx.sql);
            const ms = Date.now() - t0;
            results.created.push({ name: idx.name, table: idx.table, ms });
            process.stdout.write(`  ✅ CREATED [${ms}ms]: ${idx.name} ON ${idx.table}\n`);
        } catch (err) {
            results.errors.push({ name: idx.name, error: err.message });
            process.stdout.write(`  ❌ ERROR: ${idx.name} — ${err.message}\n`);
        }
    }

    await conn.end();

    console.log('\n==============================');
    console.log(`RESULTS: ${results.created.length} created | ${results.skipped.length} skipped | ${results.errors.length} errors`);
    if (results.errors.length > 0) {
        console.log('ERRORS:', results.errors);
    }
}

main().catch(console.error);
