/**
 * Lynx EMS — Otimização de índices do banco u494795077_SINCO.
 *
 * - Idempotente: só cria o que ainda não existe (ou não é prefixo de um índice existente).
 * - Seguro: valida colunas via information_schema; ignora tabelas/colunas inexistentes.
 * - Fail-fast: aborta se MYSQL_DB != u494795077_SINCO.
 * - Padrão é DRY-RUN. Use `--apply` para criar os índices.
 *
 * Uso:  node scripts/otimizar_indices_sinco.js          (simulação)
 *       node scripts/otimizar_indices_sinco.js --apply  (executa)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const REQUIRED_DB = 'u494795077_SINCO';
const APPLY = process.argv.includes('--apply');

if ((process.env.MYSQL_DB || '').trim() !== REQUIRED_DB) {
    console.error(`ABORTADO: este script só pode rodar no banco ${REQUIRED_DB}.`);
    process.exit(1);
}

// Toda query do app passa pelo tenant rewriter (WHERE IdEmpresa = ?), então IdEmpresa lidera os compostos.
const WANTED = [
    // [tabela, [colunas]]
    ['app_sgq_rncs', ['IdEmpresa', 'status', 'data_criacao']],
    ['app_sgq_rncs', ['IdEmpresa', 'pedido']],
    ['app_romaneios', ['IdEmpresa', 'status', 'data_liberacao']],
    ['app_romaneios', ['IdEmpresa', 'cliente_nome']],
    ['app_faturamento_solicitacao_itens', ['IdEmpresa', 'pedido', 'item']],
    ['faturamento_pre_etiquetas', ['IdEmpresa', 'pedido', 'item']],
    ['faturamento_pre_etiquetas', ['IdEmpresa', 'status']],
    ['app_pcp_lote_itens', ['pedido', 'item']],
    ['app_pcp_lote_itens', ['IdEmpresa', 'codigo']],
    ['pcp_manutencao_ordens', ['IdEmpresa', 'status', 'data_solicitacao']],
    ['pcp_manutencao_ordens', ['id_maquina']],
    ['pcp_manutencao_materiais', ['IdEmpresa', 'status']],
    ['pcp_manutencao_checklists_diarios', ['id_maquina', 'data_verificacao']],
    ['pcp_manutencao_operadores', ['id_maquina']],
    ['pcp_manutencao_ordens_historico', ['IdEmpresa', 'data_hora']],
    ['app_ata_viva_tarefas', ['IdEmpresa', 'status']],
    ['app_ata_viva_tarefas', ['pedido']],
    ['app_production_planning', ['IdEmpresa', 'recurso_codigo', 'data_planejada_inicio']],
    ['app_production_planning_diario', ['IdEmpresa', 'recurso_codigo', 'data_alocacao']],
    ['app_ind_producao_ativa', ['IdEmpresa', 'status']],
    ['solicitacoes_cliente', ['IdEmpresa', 'status']],
    ['app_pcp_pendencias_snapshot', ['pedido']],
    ['pcpmetal_conversas', ['pedido']],
    ['sgq_asset_transactions', ['asset_id']],
    ['sgq_asset_alerts', ['asset_id']],
    ['sgq_asset_attachments', ['asset_id']],
    ['app_sgq_nao_conformidades', ['IdEmpresa', 'recurso_codigo']],
    ['app_sgq_audit_log', ['user_id']],
    ['app_hermes_acknowledgments', ['user_id']],
    ['app_protheus_study_chat', ['user_id']],
    ['cipa_eleitores_votaram', ['usuario_id']],
    ['cipa_candidatos', ['IdEmpresa', 'status']],
    ['reservas_historico', ['IdEmpresa', 'usuario_id']],
    ['suporte_mensagens', ['usuario_id']],
    ['produtos', ['IdEmpresa', 'Codigo']],
    ['orcamento', ['IdEmpresa', 'Codigo']],
    ['projetodatacontrole', ['IdEmpresa', 'Cliente']],
    ['ordemservicoitem_processo', ['IdEmpresa', 'Situacao']],
    ['ordemservicoitempendencia', ['IdEmpresa', 'Situacao']],
    ['ordemservicoitemcontrole', ['IdEmpresa', 'Situacao']],
    ['romaneioitem', ['IdEmpresa', 'Situacao']],
    ['romaneioitemcontrole', ['IdEmpresa', 'Situacao']],
    ['tagcontrole', ['IdEmpresa', 'Situacao']]
];

const idxName = (table, cols) =>
    ('ix_' + table + '_' + cols.map(c => c.toLowerCase().replace(/^idempresa$/, 'emp')).join('_')).slice(0, 64);

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS, database: REQUIRED_DB, multipleStatements: false
    });
    const [[{ db }]] = await conn.query('SELECT DATABASE() AS db');
    if (db !== REQUIRED_DB) throw new Error('Banco inesperado: ' + db);

    const [cols] = await conn.query(
        'SELECT TABLE_NAME t, COLUMN_NAME c, DATA_TYPE d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?', [REQUIRED_DB]);
    const [idxRows] = await conn.query(
        'SELECT TABLE_NAME t, INDEX_NAME i, SEQ_IN_INDEX s, COLUMN_NAME c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX', [REQUIRED_DB]);

    const colMap = {}; // tabela(lower) -> { coluna(lower): nomeReal }
    const typeMap = {};
    cols.forEach(r => {
        const t = r.t.toLowerCase();
        (colMap[t] ||= {})[r.c.toLowerCase()] = r.c;
        typeMap[t + '.' + r.c.toLowerCase()] = r.d;
    });
    const idxMap = {}; // tabela(lower) -> { indice: [colunas lower] }
    const realTable = {};
    idxRows.forEach(r => {
        const t = r.t.toLowerCase(); realTable[t] = r.t;
        ((idxMap[t] ||= {})[r.i] ||= []).push(r.c.toLowerCase());
    });
    cols.forEach(r => { realTable[r.t.toLowerCase()] = r.t; });

    // Tabelas com IdEmpresa e sem índice liderado por IdEmpresa -> índice simples de tenant
    const plan = [...WANTED];
    Object.keys(colMap).forEach(t => {
        if (!colMap[t].idempresa) return;
        const lead = Object.values(idxMap[t] || {}).some(a => a[0] === 'idempresa');
        if (!lead && /^(int|bigint|smallint|tinyint|mediumint)$/.test(typeIdEmp(t))) plan.push([realTable[t], ['IdEmpresa']]);
    });
    function typeIdEmp(t) { return typeMap[t + '.idempresa'] || ''; }

    const results = { criado: [], existe: [], ignorado: [], erro: [] };
    const touched = new Set();

    for (const [table, wanted] of plan) {
        const t = table.toLowerCase();
        if (!colMap[t]) { results.ignorado.push(`${table}: tabela inexistente`); continue; }
        const real = wanted.map(c => colMap[t][c.toLowerCase()]);
        if (real.some(c => !c)) { results.ignorado.push(`${table}(${wanted}): coluna inexistente`); continue; }
        if (wanted.some(c => /text|blob|json/.test(typeMap[t + '.' + c.toLowerCase()] || ''))) {
            results.ignorado.push(`${table}(${wanted}): tipo TEXT/BLOB`); continue;
        }
        const lw = real.map(c => c.toLowerCase());
        const covered = Object.values(idxMap[t] || {}).some(a => lw.every((c, i) => a[i] === c));
        if (covered) { results.existe.push(`${table}(${real})`); continue; }

        const name = idxName(table, real);
        const sql = `ALTER TABLE \`${realTable[t] || table}\` ADD INDEX \`${name}\` (${real.map(c => '`' + c + '`').join(', ')})`;
        if (!APPLY) { results.criado.push(`[dry-run] ${sql}`); continue; }
        try {
            await conn.query(sql);
            (idxMap[t] ||= {})[name] = lw;
            touched.add(realTable[t] || table);
            results.criado.push(sql);
        } catch (e) {
            results.erro.push(`${table}(${real}): ${e.message}`);
        }
    }

    if (APPLY && touched.size) {
        for (const tb of touched) { try { await conn.query(`ANALYZE TABLE \`${tb}\``); } catch (_) { /* opcional */ } }
    }

    console.log(`\n=== ${APPLY ? 'APLICADO' : 'DRY-RUN'} em ${REQUIRED_DB} ===`);
    console.log(`Criados: ${results.criado.length} | Já existiam: ${results.existe.length} | Ignorados: ${results.ignorado.length} | Erros: ${results.erro.length}`);
    results.criado.forEach(s => console.log('  +', s));
    results.ignorado.forEach(s => console.log('  ~', s));
    results.erro.forEach(s => console.log('  !', s));
    await conn.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
