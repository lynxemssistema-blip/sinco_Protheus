const fs = require('fs');
const path = require('path');

const tables = [
    'app_demanda_vmi', 'app_demanda_vmi_datas', 'app_demanda_vmi_entregas_log',
    'app_demanda_vmi_lotes', 'app_demanda_vmi_map', 'app_demanda_vmi_pedidos_cache',
    'app_vmi_criticos_itens', 'app_vmi_criticos_versoes', 'app_vmi_oc_itens',
    'app_vmi_oc_lotes', 'app_vmi_pedidos', 'app_vmi_pedidos_lotes',
    'app_wabtec_bom', 'app_wabtec_escopos', 'app_wabtec_estruturas',
    'app_wabtec_imported_rows', 'app_wabtec_imports', 'app_wabtec_lotes',
    'app_wabtec_solicitacoes_compras', 'vmi_itens', 'vmi_itens_pedidos', 'vmi_leituras'
];

function scanDir(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        if (['node_modules', '.git', 'dist', 'build', '_arquivo'].includes(f)) continue;
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath, fileList);
        } else if (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.json') || f.endsWith('.sql')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

const allFiles = [...scanDir(path.resolve(__dirname, '../../server')), ...scanDir(path.resolve(__dirname, '../../client/src'))];
console.log(`Verificando referências ativas em ${allFiles.length} arquivos de código...`);

const matches = [];
for (const file of allFiles) {
    if (file.includes('tests') || file.includes('check_backlog')) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const t of tables) {
        if (content.includes(t)) {
            matches.push({ file: path.relative(path.resolve(__dirname, '../..'), file), table: t });
        }
    }
}

console.log(`Total de referências encontradas no código ativo: ${matches.length}`);
if (matches.length > 0) {
    console.table(matches);
} else {
    console.log('✅ Nenhuma das 22 tabelas órfãs é referenciada em nenhum arquivo ativo de server ou client!');
}
