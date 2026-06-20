const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const CONFIG = {
    host: '192.168.1.77',
    port: 22,
    username: 'sinco',
    password: 'Metal1401',
    algorithms: { serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519'] }
};

async function run() {
    try {
        console.log("1. Gerando arquivo zip local da pasta linux-deployment...");
        const zipPath = path.join(__dirname, '..', 'deploy.zip');
        
        // Remove existing zip if any
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }

        // Compress-Archive via PowerShell
        // Usamos -Path "linux-deployment\*" para compactar a estrutura sem a pasta raiz 'linux-deployment'
        const psCommand = `powershell -Command "Compress-Archive -Path linux-deployment\\* -DestinationPath deploy.zip -Force"`;
        execSync(psCommand, { cwd: path.join(__dirname, '..') });
        console.log("✅ Arquivo deploy.zip gerado com sucesso.");

        console.log("\n2. Conectando via SSH ao SINCO (192.168.1.77)...");
        const conn = new Client();

        conn.on('ready', () => {
            console.log('✅ Conectado via SSH!');

            conn.sftp((err, sftp) => {
                if (err) {
                    console.error('❌ Erro no SFTP:', err);
                    conn.end();
                    return;
                }

                const remoteZipPath = '/var/www/metalfisa/deploy.zip';
                console.log(`Enviando deploy.zip para o servidor em ${remoteZipPath}...`);

                sftp.fastPut(zipPath, remoteZipPath, {}, (uploadErr) => {
                    if (uploadErr) {
                        console.error('❌ Erro no upload:', uploadErr);
                        conn.end();
                        return;
                    }
                    console.log('✅ Upload concluído com sucesso!');

                    // Unzip and restart
                    // unzip -o descompacta sobrescrevendo arquivos existentes
                    const remoteCmd = 'cd /var/www/metalfisa && unzip -o deploy.zip && rm deploy.zip && pm2 restart all';
                    console.log(`Executando comando remoto para descompactar e reiniciar:\n  ${remoteCmd}`);

                    conn.exec(remoteCmd, (execErr, stream) => {
                        if (execErr) {
                            console.error('❌ Erro ao executar descompactação:', execErr);
                            conn.end();
                            return;
                        }

                        stream.on('close', (code) => {
                            console.log(`\n✅ Publicação SINCO finalizada com sucesso! (Saída código: ${code})`);
                            conn.end();
                            
                            // Limpar zip local
                            if (fs.existsSync(zipPath)) {
                                fs.unlinkSync(zipPath);
                            }
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

    } catch (e) {
        console.error("❌ Falha durante o deploy:", e.message);
        process.exit(1);
    }
}

run();
