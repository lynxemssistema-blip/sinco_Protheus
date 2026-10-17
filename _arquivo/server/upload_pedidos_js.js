const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('SSH connection ready!');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const localFile = './routes/pedidos.js';
        const remoteFile = '/var/www/metalfisa/server/routes/pedidos.js';
        
        console.log(`Uploading ${localFile} to ${remoteFile}...`);
        
        sftp.fastPut(localFile, remoteFile, (err) => {
            if (err) throw err;
            console.log('Upload successful!');
            
            // Now restart PM2
            conn.exec('pm2 restart all', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log('PM2 restart finished.');
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    console.error('STDERR: ' + data);
                });
            });
        });
    });
}).on('error', err => {
    console.error("Connection Error:", err);
}).connect({
    host: '192.168.1.77',
    port: 22,
    username: 'sinco',
    password: 'Metal1401',
    algorithms: {
        serverHostKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256']
    }
});
