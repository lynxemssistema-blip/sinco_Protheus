const { Client } = require('./server/node_modules/ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('1. Gerando pacote deploy.tar.gz a partir de linux-deployment...');
const tarFile = path.resolve(__dirname, 'deploy.tar.gz');
if (fs.existsSync(tarFile)) {
    fs.unlinkSync(tarFile);
}
execSync('tar -czf deploy.tar.gz -C linux-deployment .', { stdio: 'inherit' });
console.log(`Pacote criado com sucesso (${(fs.statSync(tarFile).size / (1024*1024)).toFixed(2)} MB).`);

console.log('2. Conectando via SSH a 192.168.1.77...');
const conn = new Client();

conn.on('ready', () => {
    console.log('SSH Conectado com sucesso!');
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('Erro ao abrir sessão SFTP:', err);
            conn.end();
            process.exit(1);
        }

        console.log('3. Fazendo upload de deploy.tar.gz para /var/www/metalfisa/deploy.tar.gz...');
        const remoteTar = '/var/www/metalfisa/deploy.tar.gz';
        sftp.fastPut(tarFile, remoteTar, (err) => {
            if (err) {
                console.error('Erro no upload SFTP:', err);
                conn.end();
                process.exit(1);
            }

            console.log('Upload concluído com sucesso!');
            console.log('4. Extraindo pacote e reiniciando serviços no servidor...');

            const remoteCmd = `
                cd /var/www/metalfisa &&
                tar -xzf deploy.tar.gz -C /var/www/metalfisa/ &&
                rm -f deploy.tar.gz &&
                cd /var/www/metalfisa/server &&
                npm install --production &&
                pm2 restart all &&
                pm2 list
            `;

            conn.exec(remoteCmd, (err, stream) => {
                if (err) {
                    console.error('Erro ao executar comandos remotos:', err);
                    conn.end();
                    process.exit(1);
                }

                stream.on('close', (code, signal) => {
                    console.log(`\n========================================`);
                    console.log(`Deploy finalizado com código de saída: ${code}`);
                    console.log(`========================================`);
                    conn.end();
                    
                    try {
                        if (fs.existsSync(tarFile)) fs.unlinkSync(tarFile);
                    } catch (e) {}

                    process.exit(code === 0 ? 0 : 1);
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('Erro de conexão SSH:', err);
    process.exit(1);
}).connect({
    host: '192.168.1.77',
    port: 22,
    username: 'sinco',
    password: 'Metal1401',
    algorithms: {
        serverHostKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256']
    }
});
