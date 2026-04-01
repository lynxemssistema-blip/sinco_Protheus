const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();
const localZip = path.resolve(__dirname, '../../deploy.zip');
const remoteZip = '/var/www/metalfisa/deploy.zip';

conn.on('ready', () => {
  console.log('Client :: ready');
      console.log('Executing restart commands...');
      conn.exec('pm2 list', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
          conn.end();
        }).on('data', (data) => {
          console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          console.log('STDERR: ' + data);
        });
      });
}).connect({
  host: '192.168.1.77',
  port: 22,
  username: 'sinco',
  password: 'Metal1401'
});
