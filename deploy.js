/**
 * MetalFisa Deploy Script
 * Transfere arquivos via SFTP usando node-ssh e reinicia PM2 no servidor.
 */
const { NodeSSH } = require('./node_modules/node-ssh');
const path = require('path');

const SSH_KEY = path.join(process.env.USERPROFILE, '.ssh', 'id_ed25519_metalfisa');
const SERVER = '192.168.1.77';
const USER = 'sinco';
const REMOTE_BASE = '/var/www/metalfisa';
const LOCAL_BASE = path.join(__dirname, 'linux-deployment');

const ssh = new NodeSSH();

async function run() {
    console.log('\n==========================================');
    console.log('  MetalFisa Deploy Script');
    console.log('  Servidor:', SERVER);
    console.log('==========================================\n');

    console.log('[1/3] Conectando ao servidor...');
    await ssh.connect({
        host: SERVER,
        username: USER,
        privateKeyPath: SSH_KEY,
        readyTimeout: 20000,
        algorithms: { serverHostKey: ['ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-rsa'] }
    });
    console.log('      OK — Conectado!\n');

    console.log('[2/3] Transferindo arquivos (backend + frontend)...');

    const failed = [];

    await ssh.putDirectory(
        path.join(LOCAL_BASE, 'server'),
        REMOTE_BASE + '/server',
        {
            recursive: true,
            concurrency: 10,
            validate: (itemPath) => {
                const base = path.basename(itemPath);
                return base !== 'node_modules' && base !== '.env';
            },
            tick(localPath, remotePath, error) {
                if (error) failed.push({ localPath, error: error.message });
            }
        }
    );

    await ssh.putDirectory(
        path.join(LOCAL_BASE, 'client'),
        REMOTE_BASE + '/client',
        {
            recursive: true,
            concurrency: 10,
            tick(localPath, remotePath, error) {
                if (error) failed.push({ localPath, error: error.message });
            }
        }
    );

    if (failed.length > 0) {
        console.warn('      AVISO: Alguns arquivos falharam:');
        failed.forEach(f => console.warn('        -', path.basename(f.localPath), '-', f.error));
    }
    console.log('      Transferência concluída.\n');

    console.log('[3/3] Reiniciando aplicação no servidor...');
    const restart = await ssh.execCommand(
        `chmod -R 755 ${REMOTE_BASE}/client && ` +
        `cd ${REMOTE_BASE}/server && ` +
        `npm install --omit=dev --silent && ` +
        `(pm2 restart all || pm2 start ecosystem.config.js) && ` +
        `pm2 status`
    );

    console.log(restart.stdout);
    if (restart.stderr && !restart.stderr.includes('[PM2]')) console.error(restart.stderr);

    ssh.dispose();

    console.log('\n==========================================');
    console.log('  DEPLOY CONCLUIDO COM SUCESSO!');
    console.log('  Acesse: https://sincometal.metalfisa.com.br');
    console.log('==========================================\n');
}

run().catch(err => {
    console.error('\n[ERRO FATAL]', err.message);
    try { ssh.dispose(); } catch (_) {}
    process.exit(1);
});
