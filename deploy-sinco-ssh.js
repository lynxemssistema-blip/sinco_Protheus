const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

async function deploy() {
    try {
        console.log('🔗 Connecting to 192.168.1.77 via SSH...');
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
                kex: [
                    'diffie-hellman-group1-sha1',
                    'diffie-hellman-group14-sha1',
                    'diffie-hellman-group-exchange-sha1',
                    'diffie-hellman-group-exchange-sha256',
                    'ecdh-sha2-nistp256',
                    'ecdh-sha2-nistp384',
                    'ecdh-sha2-nistp521',
                    'curve25519-sha256',
                    'curve25519-sha256@libssh.org'
                ],
                cipher: [
                    '3des-cbc', 'aes128-cbc', 'aes192-cbc', 'aes256-cbc',
                    'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
                    'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com',
                    'chacha20-poly1305@openssh.com'
                ],
                hmac: [
                    'hmac-sha1', 'hmac-sha1-96', 'hmac-sha2-256', 'hmac-sha2-512', 'hmac-md5', 'hmac-md5-96'
                ],
                serverHostKey: [
                    'ssh-rsa',
                    'ssh-dss',
                    'ssh-ed25519',
                    'ecdsa-sha2-nistp256',
                    'ecdsa-sha2-nistp384',
                    'ecdsa-sha2-nistp521'
                ]
            }
        });
        console.log('✅ Connected.');

        const localDir = path.join(__dirname, 'linux-deployment');
        const remoteDir = '/var/www/metalfisa';

        console.log('🧹 Cleaning remote dist folder...');
        await ssh.execCommand('rm -rf /var/www/metalfisa/client/dist', { cwd: '/var/www' });

        console.log('📤 Uploading from', localDir, 'to', remoteDir);
        
        // Put Directory
        await ssh.putDirectory(localDir, remoteDir, {
            recursive: true,
            concurrency: 10,
            tick: (localPath, remotePath, error) => {
                if (error) {
                    console.log(`❌ Failed: ${localPath} -> ${error.message}`);
                }
            }
        });
        
        console.log('✅ Upload finished.');
        
        console.log('🔄 Restarting PM2 on server...');
        const result = await ssh.execCommand('cd /var/www/metalfisa/server && pm2 restart all', { cwd: '/var/www' });
        console.log('STDOUT: ' + result.stdout);
        if (result.stderr) console.log('STDERR: ' + result.stderr);
        
        ssh.dispose();
        console.log('🚀 Deployment Complete!');
        
    } catch (err) {
        console.error('❌ Deploy Error:', err);
        process.exit(1);
    }
}

deploy();
