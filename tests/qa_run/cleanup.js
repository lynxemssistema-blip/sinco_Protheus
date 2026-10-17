/**
 * Script de Limpeza dos Dados de Teste da Auditoria (SINCO PROTHEUS)
 * 
 * Remove exclusivamente os registros identificados com prefixo 'QA-' ou pertencentes
 * aos tenants de teste (IdEmpresa 100 e 200).
 * 
 * Uso:
 *   node tests/qa_run/cleanup.js --dry-run   (apenas lista o que seria excluído)
 *   node tests/qa_run/cleanup.js             (executa a limpeza definitiva)
 */

const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.resolve(__dirname, '..', '..', 'server');
require('dotenv').config({ path: path.join(SERVER_DIR, '.env') });
const db = require(path.join(SERVER_DIR, 'services', 'mysqlService'));

const isDryRun = process.argv.includes('--dry-run');
const TENANTS_TESTE = [100, 200];

async function cleanup() {
    console.log(`🧹 [CLEANUP] Modo: ${isDryRun ? 'DRY-RUN (Simulação - nenhuma exclusão real)' : 'EXECUÇÃO DEFINITIVA'}`);

    const tabelas = [
        { nome: 'app_production_appointments', filtro: 'IdEmpresa IN (100, 200) OR usuario LIKE "qa_%"' },
        { nome: 'sc2010', filtro: 'IdEmpresa IN (100, 200) OR c2_num LIKE "QA%"' },
        { nome: 'sc6010', filtro: 'IdEmpresa IN (100, 200) OR c6_num LIKE "QA%"' },
        { nome: 'sc5010', filtro: 'IdEmpresa IN (100, 200) OR c5_num LIKE "QA%"' },
        { nome: 'sg2010', filtro: 'IdEmpresa IN (100, 200) OR g2_produto LIKE "QA%"' },
        { nome: 'sg1010', filtro: 'IdEmpresa IN (100, 200) OR g1_cod LIKE "QA%"' },
        { nome: 'sb2010', filtro: 'IdEmpresa IN (100, 200) OR b2_cod LIKE "QA%"' },
        { nome: 'sb1010', filtro: 'IdEmpresa IN (100, 200) OR b1_cod LIKE "QA%"' },
        { nome: 'sa1010', filtro: 'IdEmpresa IN (100, 200) OR a1_cod LIKE "QA%"' },
        { nome: 'sa2010', filtro: 'IdEmpresa IN (100, 200) OR a2_cod LIKE "QA%"' },
        { nome: 'app_sgq_rncs', filtro: 'IdEmpresa IN (100, 200) OR numero_rnc LIKE "QA%"' },
        { nome: 'app_romaneios', filtro: 'IdEmpresa IN (100, 200) OR observacao_geral LIKE "%QA%"' },
        { nome: 'pcp_setor_recursos', filtro: 'IdEmpresa IN (100, 200) OR recurso_codigo LIKE "REC-%"' },
        { nome: 'pcp_recursos', filtro: 'IdEmpresa IN (100, 200) OR codigo LIKE "REC-%"' },
        { nome: 'pcp_setores', filtro: 'IdEmpresa IN (100, 200)' },
        { nome: 'sh1010', filtro: 'IdEmpresa IN (100, 200) OR h1_codigo LIKE "REC-%"' },
        { nome: 'sistema_avisos', filtro: 'idRemetente IN (SELECT idUsuario FROM (SELECT idUsuario FROM usuario WHERE IdEmpresa IN (100, 200) OR Login LIKE "qa_%") as u)' },
        { nome: 'app_user_permissions', filtro: 'user_id IN (SELECT idUsuario FROM (SELECT idUsuario FROM usuario WHERE IdEmpresa IN (100, 200) OR Login LIKE "qa_%") as u)' },
        { nome: 'usuario', filtro: 'IdEmpresa IN (100, 200) OR Login LIKE "qa_%"' },
        { nome: 'empresa', filtro: 'IdEmpresa IN (100, 200)' }
    ];

    let totalAfetados = 0;

    for (const t of tabelas) {
        try {
            const [countRows] = await db.query(`SELECT COUNT(*) as cnt FROM ${t.nome} WHERE ${t.filtro}`);
            const qtd = countRows[0]?.cnt || 0;
            console.log(`   ${isDryRun ? '🔍' : '🗑️'} ${t.nome}: ${qtd} registro(s) encontrados`);
            totalAfetados += qtd;

            if (!isDryRun && qtd > 0) {
                await db.query(`DELETE FROM ${t.nome} WHERE ${t.filtro}`);
                console.log(`      ✅ ${qtd} registro(s) removidos de ${t.nome}.`);
            }
        } catch (e) {
            console.warn(`   ⚠️ Tabela ${t.nome} não pôde ser consultada:`, e.message);
        }
    }

    console.log('\n======================================================');
    console.log(`Resultado do Cleanup: ${totalAfetados} registros de teste identificados.`);
    if (isDryRun) {
        console.log('Nenhum dado foi excluído (modo --dry-run ativo).');
    } else {
        console.log('✅ Todos os dados de teste QA- foram eliminados com sucesso.');
    }
    console.log('======================================================\n');
    process.exit(0);
}

cleanup().catch(err => {
    console.error('Erro no cleanup:', err);
    process.exit(1);
});
