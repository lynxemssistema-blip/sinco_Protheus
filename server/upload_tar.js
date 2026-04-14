const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('SFTP session started. Uploading deploy.tar...');
    
    const readStream = fs.createReadStream('../deploy.tar');
    const writeStream = sftp.createWriteStream('/var/www/metalfisa/deploy.tar');
    
    writeStream.on('close', () => {
      console.log('Upload completed! Now extracting and restarting via SSH...');
      
      const cmd = `
        cd /var/www/metalfisa
        rm -rf ./server ./client ./ecosystem.config.js
        tar -xvf deploy.tar
        rm deploy.tar
        cd server
        npm install
        pm2 restart ecosystem.config.js
      `;
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
          conn.end();
        }).on('data', (data) => {
          console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          console.error('STDERR: ' + data);
        });
      });
    });
    
    writeStream.on('error', (err) => {
      console.error('SFTP Write Event Error:', err);
    });

    readStream.pipe(writeStream);
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
