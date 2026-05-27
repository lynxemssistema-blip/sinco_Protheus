const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const ssh = new NodeSSH();

async function readLogs() {
    try {
        await ssh.connect({
            host: '192.168.1.77',
            username: 'sinco',
            password: 'Metal1401', port: 22, tryKeyboard: true,
            onKeyboardInteractive: (n, i, il, prompts, finish) => {
                if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) finish(['Metal1401']);
            },
            algorithms: { serverHostKey: [ 'ssh-rsa', 'ssh-dss', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521' ] }
        });
        const result = await ssh.execCommand('pm2 logs metalfisa_producao --lines 150 --raw --nostream');
        fs.writeFileSync('server_pm2_logs.txt', result.stdout + '\n' + result.stderr);
        ssh.dispose();
    } catch(e) {
        console.error(e);
    }
}
readLogs();
