const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const mysqldump = require('mysqldump');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Aplica patch seguro no mysql2.createConnection para remover limites de tempo de query
 * com compatibilidade total para MySQL 8.0, MySQL 5.7 e MariaDB (10.x/11.x).
 */
function patchMysql2CreateConnection(pkgPath) {
    let mod;
    try {
        mod = require(pkgPath);
    } catch (err) {
        return;
    }
    if (mod.__maxStatementTimePatched) return;
    const originalCreateConnection = mod.createConnection;
    mod.createConnection = function patchedCreateConnection(...args) {
        const connection = originalCreateConnection.apply(mod, args);

        // 1. MySQL 8.0 & MariaDB: desativa max_statement_time (se suportado)
        connection.query('SET SESSION max_statement_time=0', (err) => {
            // Ignora silenciosamente caso a variável não exista na versão do banco (ex: MySQL 5.7 puro)
        });

        // 2. MySQL 5.7.8+ & MySQL 8.0: desativa max_execution_time (em milissegundos, 0 = infinito)
        connection.query('SET SESSION max_execution_time=0', (err) => {
            // Ignora silenciosamente caso não exista
        });

        // 3. MySQL 5.7 & 8.0: eleva timeouts de rede e espera para evitar 'MySQL server has gone away'
        connection.query('SET SESSION wait_timeout=28800, interactive_timeout=28800, net_read_timeout=3600, net_write_timeout=3600', (err) => {
            // Ignora caso restrito por permissão
        });

        return connection;
    };
    mod.__maxStatementTimePatched = true;
}

patchMysql2CreateConnection('mysql2');
patchMysql2CreateConnection('mysqldump/node_modules/mysql2');

function startBackupCron() {
    // Executa diariamente à meia-noite (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Iniciando rotina de backup do banco de dados (compatível com MySQL 8.0 e 5.7)...');
        await runBackup();
    });
}

function getFormattedDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

async function runBackup() {
    let filePath = null;
    try {
        // Determina o diretório de destino de acordo com o Sistema Operacional
        let targetDir;
        if (process.platform === 'win32') {
            targetDir = '\\\\192.168.1.253\\Estrutura Lynx\\020-BACKUP_BD';
        } else {
            targetDir = '/mnt/lynx/020-BACKUP_BD';
        }

        // Garante que o diretório de destino exista ou cria recursivamente
        if (!fs.existsSync(targetDir)) {
            console.warn(`[BACKUP DB] Aviso: O diretório de destino (${targetDir}) não existe ou está inacessível. Tentando criar localmente/rede...`);
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (err) {
                console.error(`[BACKUP DB] Falha ao tentar criar o diretório de destino: ${err.message}`);
                throw err;
            }
        }

        const host = process.env.MYSQL_HOST;
        const user = process.env.MYSQL_USER;
        const pass = process.env.MYSQL_PASS;
        const db = process.env.MYSQL_DB;

        if (!host || !user || !pass || !db) {
            console.error('[BACKUP DB] Erro: Credenciais do banco de dados (MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DB) não encontradas no .env');
            throw new Error('Credenciais faltando no .env');
        }

        const fileName = `backup_${db}_${getFormattedDate()}.sql`;
        filePath = path.join(targetDir, fileName);

        console.log(`[BACKUP DB] Gerando dump completo (MySQL 8.0 / 5.7). Destino: ${filePath}`);

        await mysqldump({
            connection: {
                host: host,
                user: user,
                password: pass,
                database: db,
                charset: 'utf8mb4',
                connectTimeout: 60000,
                multipleStatements: true
            },
            dump: {
                schema: {
                    table: {
                        dropIfExist: true
                    }
                },
                data: {
                    maxRowsPerInsertStatement: 1000 // Compatível com limites de max_allowed_packet do MySQL 5.7 e 8.0
                },
                trigger: {
                    dropIfExist: true
                }
            },
            dumpToFile: filePath,
        });

        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`[BACKUP DB] Backup concluído com sucesso: ${fileName} (${sizeMB} MB)`);
        return filePath;
    } catch (err) {
        console.error(`[BACKUP DB] Erro inesperado na rotina de backup: ${err.message}`);
        // Remove arquivo corrompido ou vazio se gerado parcialmente
        if (filePath && fs.existsSync(filePath)) {
            try {
                const s = fs.statSync(filePath);
                if (s.size === 0) {
                    fs.unlinkSync(filePath);
                    console.log(`[BACKUP DB] Arquivo vazio removido: ${filePath}`);
                }
            } catch (e) {}
        }
        throw err;
    }
}

module.exports = {
    startBackupCron,
    runBackup // Exportado para execução sob demanda ou testes manuais
};
