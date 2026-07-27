const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

function startBackupCron() {
    // Run everyday at 00:00 (midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Iniciando rotina de backup do banco de dados MySQL...');
        await runBackup();
    });
}

function getFormattedDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

async function runBackup() {
    return new Promise((resolve, reject) => {
        try {
            // Determine target directory based on OS
            let targetDir;
            if (process.platform === 'win32') {
                targetDir = '\\\\192.168.1.253\\Estrutura Lynx\\021-RNC';
            } else {
                targetDir = '/mnt/lynx/021-RNC';
            }

            // Ensure directory exists or is accessible
            if (!fs.existsSync(targetDir)) {
                console.warn(`[BACKUP DB] Aviso: O diretório de destino (${targetDir}) não existe ou está inacessível. O script tentará criá-lo localmente se possível.`);
                try {
                    fs.mkdirSync(targetDir, { recursive: true });
                } catch (err) {
                    console.error(`[BACKUP DB] Falha ao tentar criar o diretório de destino: ${err.message}`);
                    return reject(err);
                }
            }

            const host = process.env.MYSQL_HOST;
            const user = process.env.MYSQL_USER;
            const pass = process.env.MYSQL_PASS;
            const db = process.env.MYSQL_DB;

            if (!host || !user || !pass || !db) {
                console.error('[BACKUP DB] Erro: Credenciais do banco de dados (MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DB) não encontradas no .env');
                return reject(new Error('Credenciais faltando no .env'));
            }

            const fileName = `backup_${db}_${getFormattedDate()}.sql`;
            const filePath = path.join(targetDir, fileName);

            // Construct mysqldump command
            // -p sem espaço é obrigatório no mysqldump
            const cmd = `mysqldump -h ${host} -u ${user} -p"${pass}" ${db} > "${filePath}"`;

            console.log(`[BACKUP DB] Gerando dump de segurança. Destino: ${filePath}`);

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[BACKUP DB] Erro ao executar mysqldump: ${error.message}`);
                    // Remove o arquivo de 0KB se o comando falhou
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`[BACKUP DB] Arquivo vazio ${fileName} removido após falha.`);
                        } catch (unlinkErr) {
                            console.error(`[BACKUP DB] Falha ao remover arquivo vazio: ${unlinkErr.message}`);
                        }
                    }
                    return reject(error);
                }
                
                // Note: mysqldump writes some warnings to stderr (e.g. "Using a password on the command line interface can be insecure.")
                if (stderr && stderr.toLowerCase().includes('error')) {
                    console.error(`[BACKUP DB] Aviso/Erro durante o dump: ${stderr}`);
                }

                console.log(`[BACKUP DB] Backup concluído com sucesso: ${fileName}`);
                resolve(filePath);
            });
            
        } catch (err) {
            console.error(`[BACKUP DB] Erro inesperado na rotina de backup: ${err.message}`);
            reject(err);
        }
    });
}

module.exports = {
    startBackupCron,
    runBackup // Exported for manual testing
};
