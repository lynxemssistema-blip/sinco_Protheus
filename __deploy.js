const { Client } = require('./server/node_modules/ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('SFTP :: ready, uploading deploy.zip...');
    sftp.fastPut('./deploy.zip', '/var/www/metalfisa/deploy.zip', (err) => {
      if (err) throw err;
      console.log('SFTP :: fastPut completed. Extracting and restarting PM2...');
      conn.exec('cd /var/www/metalfisa && unzip -o deploy.zip && rm deploy.zip && cd server && npm install && pm2 restart all', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          console.log('Restart completed with code: ' + code);
          conn.end();
        }).on('data', (data) => {
          console.log('' + data);
        }).stderr.on('data', (data) => {
          console.error('' + data);
        });
      });
    });
  });
}).connect({
  host: '192.168.1.77',
  port: 22,
  username: 'sinco',
  password: 'Metal1401'
});
