const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function getLogs() {
    try {
        await ssh.connect({
            host: '192.168.1.77',
            username: 'sinco',
            password: 'Metal1401',
            port: 22,
            tryKeyboard: true,
            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) finish(['Metal1401']);
            }
        });
        const result = await ssh.execCommand('grep -i "cronograma" /home/sinco/.pm2/logs/metalfisa-producao-error.log | tail -n 50', { cwd: '/var/www' });
        console.log(result.stdout);
        ssh.dispose();
    } catch (err) {
        console.error(err);
    }
}
getLogs();
