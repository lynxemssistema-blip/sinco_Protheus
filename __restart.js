const { Client } = require('./server/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('pm2 restart metalfisa_producao', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Done with code: ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log('' + data);
    }).stderr.on('data', (data) => {
      console.error('' + data);
    });
  });
}).connect({
  host: '192.168.1.77',
  port: 22,
  username: 'sinco',
  password: 'Metal1401'
});
