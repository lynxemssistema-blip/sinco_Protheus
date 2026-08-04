const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function readLogs() {
    try {
        await ssh.connect({
            host: '192.168.1.77',
            username: 'sinco',
            password: 'Metal1401', 
            port: 22, 
            tryKeyboard: true,
            onKeyboardInteractive: (n, i, il, prompts, finish) => {
                if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) finish(['Metal1401']);
            },
            algorithms: { serverHostKey: [ 'ssh-rsa', 'ssh-dss', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521' ] }
        });
        
        console.log('Searching PM2 logs for PROTHEUS APONTAMENTO...');
        const result = await ssh.execCommand('grep -i "PROTHEUS APONTAMENTO" /home/sinco/.pm2/logs/metalfisa-producao-out.log | tail -n 50');
        console.log('STDOUT:');
        console.log(result.stdout);
        
        console.log('\nSearching PM2 error logs...');
        const resultErr = await ssh.execCommand('grep -i "PROTHEUS APONTAMENTO" /home/sinco/.pm2/logs/metalfisa-producao-error.log | tail -n 50');
        console.log('STDERR:');
        console.log(resultErr.stdout);

        ssh.dispose();
    } catch(e) {
        console.error(e);
    }
}
readLogs();
