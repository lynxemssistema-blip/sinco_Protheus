const fs = require('fs');
const path = require('path');
const pool = require('./services/mysqlService');

async function auditTables() {
    try {
        console.log('=== AUDITORIA COMPLETA DE TABELAS (BUSCA POR TABELAS LIXO / OBSOLETAS) ===\n');

        // 1. Obter todas as tabelas do schema atual
        const [tables] = await pool.query(`
            SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, TABLE_COMMENT
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);

        console.log(`Total de tabelas físicas no banco: ${tables.length}`);

        // 2. Coletar arquivos do backend e frontend para verificar referências reais no código
        function getAllCodeFiles(dir, fileList = []) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') continue;
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    getAllCodeFiles(fullPath, fileList);
                } else if (/\.(js|jsx|ts|tsx|sql|json)$/i.test(file)) {
                    fileList.push(fullPath);
                }
            }
            return fileList;
        }

        const serverFiles = getAllCodeFiles(path.join(__dirname));
        const clientFiles = getAllCodeFiles(path.join(__dirname, '../client/src'));
        const allFiles = [...serverFiles, ...clientFiles];

        console.log(`Arquivos de código examinados: ${allFiles.length}`);

        // Ler conteúdo consolidado ou fazer busca para checagem rápida
        // Ler todos os arquivos em memória para busca ultra rápida
        const codeContents = allFiles.map(f => {
            try {
                return { path: f, content: fs.readFileSync(f, 'utf8') };
            } catch (e) {
                return { path: f, content: '' };
            }
        });

        const junkTables = [];
        const activeTables = [];
        const zeroRowUnreferenced = [];

        for (const t of tables) {
            const name = t.TABLE_NAME;
            const rows = t.TABLE_ROWS || 0;

            // Padrões de tabela de lixo/backup/temporária
            const isBackupPattern = /_backup|_bkp|_old|_temp|_tmp|_teste|_test|_copy|\d{10,}/i.test(name);
            const isProtheusWorkTable = /^(sz[a-z0-9]|tmp_|wrk_|work_)/i.test(name);

            // Contar ocorrências do nome da tabela no código fonte (excluindo scripts de checagem/audit)
            let codeMatches = 0;
            const regex = new RegExp(`\\b${name}\\b`, 'i');
            for (const item of codeContents) {
                // Não contar este próprio script de auditoria nem scripts scratch temporários
                if (item.path.includes('audit_tables.js') || item.path.includes('scratch_') || item.path.includes('check_')) continue;
                if (regex.test(item.content)) {
                    codeMatches++;
                }
            }

            // Real count no banco para precisão
            let realCount = 0;
            try {
                const [cntRes] = await pool.query(`SELECT COUNT(*) as c FROM \`${name}\``);
                realCount = cntRes[0].c;
            } catch (err) {
                realCount = rows;
            }

            if (isBackupPattern) {
                junkTables.push({
                    table: name,
                    motivo: 'Tabela de backup/temporária (Timestamp ou sufixo _backup/_old)',
                    linhas: realCount,
                    referenciasCodigo: codeMatches
                });
            } else if (codeMatches === 0 && realCount === 0) {
                zeroRowUnreferenced.push({
                    table: name,
                    motivo: 'Vazia (0 linhas) e NENHUMA referência encontrada no código',
                    linhas: 0,
                    referenciasCodigo: 0
                });
            } else if (codeMatches === 0 && realCount > 0) {
                junkTables.push({
                    table: name,
                    motivo: 'Possível tabela órfã/legada (Possui linhas, mas NUNCA é chamada no código)',
                    linhas: realCount,
                    referenciasCodigo: 0
                });
            } else {
                activeTables.push({
                    table: name,
                    linhas: realCount,
                    referenciasCodigo: codeMatches
                });
            }
        }

        console.log(`\n======================================================`);
        console.log(`1. TABELAS DE BACKUP / TEMPORÁRIAS EVIDENTES (${junkTables.filter(j => j.motivo.includes('backup')).length}):`);
        console.table(junkTables.filter(j => j.motivo.includes('backup')));

        console.log(`\n======================================================`);
        console.log(`2. TABELAS ÓRFÃS / LEGADAS (NUNCA CHAMADAS NO CÓDIGO) (${junkTables.filter(j => j.motivo.includes('órfã')).length}):`);
        console.table(junkTables.filter(j => j.motivo.includes('órfã')));

        console.log(`\n======================================================`);
        console.log(`3. TABELAS VAZIAS E SEM NENHUM USO NO SISTEMA (${zeroRowUnreferenced.length}):`);
        console.table(zeroRowUnreferenced);

        console.log(`\n======================================================`);
        console.log(`4. RESUMO GERAL:`);
        console.log(`- Tabelas Ativas / Úteis: ${activeTables.length}`);
        console.log(`- Tabelas Lixo Evidentes (Backups/Temporárias): ${junkTables.filter(j => j.motivo.includes('backup')).length}`);
        console.log(`- Tabelas Órfãs com dados mas sem uso: ${junkTables.filter(j => j.motivo.includes('órfã')).length}`);
        console.log(`- Tabelas Vazias e sem referência: ${zeroRowUnreferenced.length}`);
        console.log(`- TOTAL ANALISADO: ${tables.length}`);

        // Salvar relatório detalhado em JSON para consulta
        fs.writeFileSync(
            path.join(__dirname, 'relatorio_tabelas_lixo.json'), 
            JSON.stringify({ 
                totalTabelas: tables.length,
                tabelasBackup: junkTables.filter(j => j.motivo.includes('backup')),
                tabelasOrfas: junkTables.filter(j => j.motivo.includes('órfã')),
                tabelasVaziasSemUso: zeroRowUnreferenced
            }, null, 2)
        );

        console.log('\nRelatório salvo em server/relatorio_tabelas_lixo.json');
        process.exit(0);
    } catch (e) {
        console.error('Erro na auditoria:', e);
        process.exit(1);
    }
}

auditTables();
