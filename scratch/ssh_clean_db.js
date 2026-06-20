const { Client } = require('ssh2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const CONFIG = {
    host: '192.168.1.77',
    port: 22,
    username: 'sinco',
    password: process.env.SINCO_SSH_PASSWORD || 'Metal1401',
    algorithms: { serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519'] }
};

const conn = new Client();

const nodeCommand = `
const mysqlPool = require('./services/mysqlService');
async function clean() {
    try {
        console.log('Iniciando limpeza remota...');
        await mysqlPool.query('SET FOREIGN_KEY_CHECKS = 0');
        
        console.log('Limpando pcp_programas_paradas...');
        await mysqlPool.query('DELETE FROM pcp_programas_paradas');
        
        console.log('Limpando pcp_programas_execucoes...');
        await mysqlPool.query('DELETE FROM pcp_programas_execucoes');
        
        console.log('Limpando pcp_programas_liberados...');
        await mysqlPool.query('DELETE FROM pcp_programas_liberados');
        
        console.log('Limpando app_lotes_corte_itens...');
        await mysqlPool.query('DELETE FROM app_lotes_corte_itens');
        
        console.log('Limpando app_lotes_corte...');
        await mysqlPool.query('DELETE FROM app_lotes_corte');
        
        console.log('Resetando AUTO_INCREMENTs...');
        try {
            await mysqlPool.query('ALTER TABLE pcp_programas_paradas AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE pcp_programas_execucoes AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE pcp_programas_liberados AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE app_lotes_corte_itens AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE app_lotes_corte AUTO_INCREMENT = 1');
        } catch (e) {
            console.log('Aviso ao resetar AUTO_INCREMENT:', e.message);
        }
        
        await mysqlPool.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ CLEANUP_SUCCESS');
        process.exit(0);
    } catch(e) {
        console.error('❌ Erro no script remoto:', e);
        process.exit(1);
    }
}
clean();
`.replace(/\n/g, ' ').replace(/"/g, '\\"');

const sshCommand = `cd /var/www/metalfisa/server && node -e "${nodeCommand}"`;

conn.on('ready', () => {
    console.log('✅ Conectado ao servidor SINCO via SSH para limpeza...');
    conn.exec(sshCommand, (err, stream) => {
        if (err) {
            console.error('❌ Erro ao executar comando SSH:', err);
            conn.end();
            return;
        }
        stream.on('close', (code) => {
            console.log(`\nComando SSH encerrado com código de saída: ${code}`);
            conn.end();
            process.exit(code);
        }).on('data', d => process.stdout.write(d.toString()))
          .stderr.on('data', d => process.stderr.write(d.toString()));
    });
});

conn.on('error', err => {
    console.error('❌ Erro de conexão SSH:', err.message);
    process.exit(1);
});

conn.connect(CONFIG);
