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
            },
            algorithms: {
                kex: ['diffie-hellman-group1-sha1','diffie-hellman-group14-sha1','diffie-hellman-group-exchange-sha1','diffie-hellman-group-exchange-sha256','ecdh-sha2-nistp256','ecdh-sha2-nistp384','ecdh-sha2-nistp521','curve25519-sha256','curve25519-sha256@libssh.org'],
                cipher: ['3des-cbc', 'aes128-cbc', 'aes192-cbc', 'aes256-cbc','aes128-ctr', 'aes192-ctr', 'aes256-ctr','aes128-gcm@openssh.com', 'aes256-gcm@openssh.com','chacha20-poly1305@openssh.com'],
                hmac: ['hmac-sha1', 'hmac-sha1-96', 'hmac-sha2-256', 'hmac-sha2-512', 'hmac-md5', 'hmac-md5-96'],
                serverHostKey: ['ssh-rsa','ssh-dss','ssh-ed25519','ecdsa-sha2-nistp256','ecdsa-sha2-nistp384','ecdsa-sha2-nistp521']
            }
        });
        const result = await ssh.execCommand('pm2 logs metalfisa_producao --lines 100 --nostream', { cwd: '/var/www' });
        console.log(result.stdout);
        if (result.stderr) console.log('STDERR:', result.stderr);
        ssh.dispose();
    } catch (err) {
        console.error(err);
    }
}
getLogs();
