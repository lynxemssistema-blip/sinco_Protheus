const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const CONFIG = {
    host: '192.168.1.77',
    port: 22,
    username: 'sinco',
    password: process.env.SINCO_SSH_PASSWORD,
    algorithms: { serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519'] }
};

const LOCAL_BASE = path.join(__dirname, 'linux-deployment');
const REMOTE_BASE = '/var/www/metalfisa';

function getAllFiles(dir, base = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(getAllFiles(fullPath, base));
        } else {
            files.push({ local: fullPath, relative: path.relative(base, fullPath).replace(/\\/g, '/') });
        }
    }
    return files;
}

async function ensureDir(sftp, remotePath) {
    const parts = remotePath.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
        current += '/' + part;
        await new Promise(resolve => {
            sftp.mkdir(current, () => resolve()); // ignora erro se já existe
        });
    }
}

async function deploy() {
    const conn = new Client();

    conn.on('ready', () => {
        console.log('✅ Conectado ao servidor SINCO!');
        conn.sftp(async (err, sftp) => {
            if (err) { console.error('❌ Erro SFTP:', err); conn.end(); return; }

            const files = getAllFiles(LOCAL_BASE);
            console.log(`📦 ${files.length} arquivos para enviar...`);

            let sent = 0;
            for (const file of files) {
                const remotePath = REMOTE_BASE + '/' + file.relative;
                const remoteDir = path.dirname(remotePath).replace(/\\/g, '/');

                await ensureDir(sftp, remoteDir);

                await new Promise((resolve, reject) => {
                    sftp.fastPut(file.local, remotePath, (err) => {
                        if (err) { console.error(`  ❌ Erro ao enviar ${file.relative}:`, err.message); }
                        else { sent++; }
                        resolve();
                    });
                });

                const pct = Math.round((sent / files.length) * 100);
                if (sent % 10 === 0 || sent === files.length) {
                    process.stdout.write(`\r  📤 ${sent}/${files.length} (${pct}%)`);
                }
            }

            console.log(`\n✅ ${sent} arquivos enviados com sucesso!`);

            // Restart via exec
            console.log('\n🔄 Configurando variáveis e reiniciando servidor...');
            conn.exec('cd /var/www/metalfisa/server && grep -q "JWT_SECRET" .env || echo "\\nJWT_SECRET=metalfisasecuritykey2026\\n" >> .env && npm install --omit=dev && pm2 restart all', (err, stream) => {
                if (err) { console.error('❌ Erro ao reiniciar:', err); conn.end(); return; }
                stream.on('close', (code) => {
                    if (code === 0) console.log('✅ Servidor reiniciado com sucesso!');
                    else console.log(`⚠️  pm2 restart saiu com código ${code} (pode ser normal se o nome do processo for diferente)`);
                    console.log('\n🌐 App disponível em: http://192.168.1.77:3001/');
                    conn.end();
                }).on('data', d => process.stdout.write(d.toString()))
                    .stderr.on('data', d => process.stderr.write(d.toString()));
            });
        });
    });

    conn.on('error', err => {
        console.error('❌ Erro de conexão SSH:', err.message);
        process.exit(1);
    });

    conn.connect(CONFIG);
}

deploy().catch(e => { console.error(e); process.exit(1); });
