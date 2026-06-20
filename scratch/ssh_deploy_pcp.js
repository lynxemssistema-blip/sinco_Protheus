const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const CONFIG = {
    host: '192.168.1.77',
    port: 22,
    username: 'sinco',
    password: 'Metal1401',
    algorithms: { serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519'] }
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Conectado via SSH ao SINCO para publicação...');
    
    // SFTP upload
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('❌ Erro no SFTP:', err);
            conn.end();
            return;
        }

        const localPath = path.join(__dirname, '..', 'server', 'routes', 'pcpProgramas.js');
        const remotePath = '/var/www/metalfisa/server/routes/pcpProgramas.js';

        console.log(`Enviando ${localPath} para ${remotePath}...`);

        sftp.fastPut(localPath, remotePath, {}, (uploadErr) => {
            if (uploadErr) {
                console.error('❌ Erro no upload:', uploadErr);
                conn.end();
                return;
            }
            console.log('✅ Upload concluído com sucesso!');

            // Restart PM2
            const restartCmd = 'pm2 restart all';
            console.log(`Executando comando remoto: ${restartCmd}`);
            conn.exec(restartCmd, (execErr, stream) => {
                if (execErr) {
                    console.error('❌ Erro ao reiniciar:', execErr);
                    conn.end();
                    return;
                }
                stream.on('close', (code) => {
                    console.log(`✅ Serviço reiniciado via PM2 (code: ${code})`);
                    conn.end();
                    process.exit(0);
                }).on('data', d => process.stdout.write(d.toString()))
                  .stderr.on('data', d => process.stderr.write(d.toString()));
            });
        });
    });
});

conn.on('error', err => {
    console.error('❌ Erro de conexão SSH:', err.message);
    process.exit(1);
});

conn.connect(CONFIG);
