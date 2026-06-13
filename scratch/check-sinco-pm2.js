const { Client } = require('ssh2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Conectado via SSH ao Servidor SINCO.');
    conn.exec('pm2 list', (err, stream) => {
        if (err) {
            console.error('Erro ao executar pm2 list:', err);
            conn.end();
            return;
        }
        stream.on('close', () => {
            conn.end();
        }).on('data', d => {
            console.log(d.toString());
        }).stderr.on('data', d => {
            console.error(d.toString());
        });
    });
}).on('error', err => {
    console.error('❌ Erro na conexão SSH:', err.message);
}).connect({
    host: '192.168.1.77',
    username: 'sinco',
    password: process.env.SINCO_SSH_PASSWORD,
    port: 22
});
