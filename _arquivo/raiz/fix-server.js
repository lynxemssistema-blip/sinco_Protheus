const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixServer() {
    try {
        console.log('🔗 Connecting to 192.168.1.77 via SSH for quick fix...');
        await ssh.connect({
            host: '192.168.1.77',
            username: 'sinco',
            password: 'Metal1401', port: 22, tryKeyboard: true,
            onKeyboardInteractive: (n, i, il, prompts, finish) => {
                if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) finish(['Metal1401']);
            },
            algorithms: { serverHostKey: [ 'ssh-rsa', 'ssh-dss', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521' ] }
        });
        
        console.log('🗑️ Deleting node_modules...');
        await ssh.execCommand('rm -rf /var/www/metalfisa/server/node_modules');

        console.log('📦 Running npm install on server...');
        const resultInstall = await ssh.execCommand('cd /var/www/metalfisa/server && npm install --omit=dev', { cwd: '/var/www' });
        console.log('INSTALL STDOUT:', resultInstall.stdout);
        if (resultInstall.stderr) console.log('INSTALL STDERR:', resultInstall.stderr);

        console.log('🔄 Restarting PM2...');
        const resultRestart = await ssh.execCommand('cd /var/www/metalfisa/server && pm2 restart all', { cwd: '/var/www' });
        console.log('RESTART STDOUT:', resultRestart.stdout);

        ssh.dispose();
    } catch(e) {
        console.error(e);
    }
}
fixServer();
