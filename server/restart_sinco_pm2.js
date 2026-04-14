const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  const cmd = `pm2 restart all --update-env`;
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
