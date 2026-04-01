const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const conn = new Client();
const localZip = path.resolve(__dirname, 'deploy.zip');
const remoteZip = '/var/www/metalfisa/deploy.zip';

console.log('Iniciando deploy automático para 192.168.1.77...');

conn.on('ready', () => {
    console.log('✅ SSH Conectado.');
    
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('Erro no SFTP:', err);
            conn.end();
            return;
        }
        
        console.log(`⬆️ Fazendo upload do pacote (Pode levar alguns segundos)...`);
        sftp.fastPut(localZip, remoteZip, {}, (err) => {
            if (err) {
                console.error('Erro no fastPut:', err);
                conn.end();
                return;
            }
            console.log('✅ Upload concluído. Extraindo pacote...');
            
            const deployCommand = `unzip -o ${remoteZip} -d /var/www/metalfisa/ && cd /var/www/metalfisa/server && npm install && pm2 restart ecosystem.config.js`;
            
            conn.exec(deployCommand, (err, stream) => {
                if (err) {
                    console.error('Erro ao executar comandos remotos:', err);
                    conn.end();
                    return;
                }
                
                stream.on('close', (code, signal) => {
                    console.log(`✅ Servidor Atualizado! pm2 restart executado [code: ${code}].`);
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('❌ SSH Erro:', err);
}).connect({
    host: '192.168.1.77',
    port: 22,
    username: 'sinco',
    password: 'Metal1401'
});
