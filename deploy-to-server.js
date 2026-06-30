const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

const SSH_CONFIG = {
    host: '192.168.1.77',
    username: 'sinco',
    password: 'Metal1401',
    port: 22,
    tryKeyboard: true,
    onKeyboardInteractive: (n, i, il, prompts, finish) => {
        if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
            finish(['Metal1401']);
        }
    },
    algorithms: {
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ssh-ed25519', 'ecdsa-sha2-nistp256']
    }
};

const LOCAL_DIR = path.join(__dirname, 'linux-deployment');
const REMOTE_DIR = '/var/www/metalfisa';

function getAllFiles(dir, baseDir = dir) {
    const result = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            result.push(...getAllFiles(fullPath, baseDir));
        } else {
            result.push(fullPath);
        }
    }
    return result;
}

async function deploy() {
    console.log('🚀 Iniciando deploy para 192.168.1.77...\n');

    try {
        console.log('📡 Conectando ao servidor...');
        await ssh.connect(SSH_CONFIG);
        console.log('✅ Conectado!\n');

        // Upload all files via SFTP
        const allFiles = getAllFiles(LOCAL_DIR);
        console.log(`📦 Total de arquivos para enviar: ${allFiles.length}`);
        
        let sent = 0;
        for (const localFile of allFiles) {
            const relativePath = path.relative(LOCAL_DIR, localFile).replace(/\\/g, '/');
            const remoteFile = `${REMOTE_DIR}/${relativePath}`;
            const remoteDir = remoteFile.substring(0, remoteFile.lastIndexOf('/'));

            // Ensure remote directory exists
            await ssh.execCommand(`mkdir -p "${remoteDir}"`);
            await ssh.putFile(localFile, remoteFile);
            
            sent++;
            if (sent % 20 === 0 || sent === allFiles.length) {
                const pct = Math.round((sent / allFiles.length) * 100);
                process.stdout.write(`\r  ↑ [${pct}%] ${sent}/${allFiles.length} arquivos enviados...`);
            }
        }

        console.log('\n✅ Upload concluído!\n');

        // Install dependencies
        console.log('📦 Instalando dependências no servidor (npm install)...');
        const install = await ssh.execCommand('cd /var/www/metalfisa/server && npm install --omit=dev 2>&1');
        if (install.stdout) console.log(install.stdout.slice(-500));
        if (install.stderr) console.log('   WARN:', install.stderr.slice(-300));
        console.log('✅ npm install concluído!\n');

        // Restart PM2 — usa o nome do processo (metalfisa_producao) pois o servidor
        // não usa ecosystem.config.js diretamente no pm2 start
        console.log('🔄 Reiniciando aplicação com PM2...');
        const pm2 = await ssh.execCommand(
            'pm2 restart metalfisa_producao --update-env 2>&1 || ' +
            'pm2 restart all --update-env 2>&1'
        );
        console.log(pm2.stdout || pm2.stderr);
        console.log('✅ PM2 reiniciado!\n');

        // Verify
        const status = await ssh.execCommand('pm2 list 2>&1');
        console.log('📊 Status PM2:\n', status.stdout);

        ssh.dispose();

        console.log('\n══════════════════════════════════════');
        console.log('  ✅ DEPLOY CONCLUÍDO COM SUCESSO!');
        console.log(`  🌐 App disponível em: http://192.168.1.77:3001/`);
        console.log('══════════════════════════════════════\n');

    } catch (err) {
        console.error('\n❌ ERRO no deploy:', err.message || err);
        ssh.dispose();
        process.exit(1);
    }
}

deploy();
