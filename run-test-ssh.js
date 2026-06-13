const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function runTest() {
    try {
        await ssh.connect({
            host: '192.168.1.77',
            username: 'sinco',
            password: 'Metal1401',
            port: 22,
            tryKeyboard: true,
            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
                    finish(['Metal1401']);
                }
            },
            algorithms: {
                serverHostKey: ['ssh-rsa', 'ssh-dss', 'ssh-ed25519', 'ecdsa-sha2-nistp256']
            }
        });
        const result = await ssh.execCommand('cat /var/www/metalfisa/server/.env', { cwd: '/var/www' });
        console.log('STDOUT:', result.stdout);
        ssh.dispose();
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
runTest();
