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
        const result = await ssh.execCommand('cd /var/www/metalfisa/server && node -e "const pool = require(\'./db\'); pool.query(\'SELECT TRIM(b1_cod) as cod, b1_tipo FROM sb1010 WHERE TRIM(b1_cod) IN (\\\'MTC-0016\\\', \\\'MTT-0292\\\', \\\'MTA-1828\\\') AND COALESCE(d_e_l_e_t_, \\\'\\\') = \\\'\\\'\').then(r => { console.log(r.rows); process.exit(0); }).catch(err => { console.error(err); process.exit(1); })"');
        console.log('STDOUT:', result.stdout);
        console.log('STDERR:', result.stderr);
        ssh.dispose();
    } catch(e) {
        console.error(e);
    }
}
readLogs();
