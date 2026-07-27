const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const mysqldump = require('mysqldump');
require('dotenv').config();

function startBackupCron() {
    // Run everyday at 00:00 (midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Iniciando rotina de backup do banco de dados MySQL (via pacote nativo)...');
        await runBackup();
    });
}

function getFormattedDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

async function runBackup() {
    try {
        // Determine target directory based on OS
        let targetDir;
        if (process.platform === 'win32') {
            targetDir = '\\\\192.168.1.253\\Estrutura Lynx\\020-BACKUP_BD';
        } else {
            targetDir = '/mnt/lynx/020-BACKUP_BD';
        }

        // Ensure directory exists or is accessible
        if (!fs.existsSync(targetDir)) {
            console.warn(`[BACKUP DB] Aviso: O diretório de destino (${targetDir}) não existe ou está inacessível. O script tentará criá-lo localmente se possível.`);
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
        const filePath = path.join(targetDir, fileName);

        console.log(`[BACKUP DB] Gerando dump de segurança (via mysqldump npm). Destino: ${filePath}`);

        await mysqldump({
            connection: {
                host: host,
                user: user,
                password: pass,
                database: db,
            },
            dumpToFile: filePath,
        });

        console.log(`[BACKUP DB] Backup concluído com sucesso: ${fileName}`);
        return filePath;
    } catch (err) {
        console.error(`[BACKUP DB] Erro inesperado na rotina de backup: ${err.message}`);
        throw err;
    }
}

module.exports = {
    startBackupCron,
    runBackup // Exported for manual testing
};
