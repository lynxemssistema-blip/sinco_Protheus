const { Client } = require('ssh2'); const path = require('path'); require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const conn = new Client();
conn.on('ready', () => {
    conn.exec(`echo "${process.env.SINCO_SSH_PASSWORD}" | sudo -S fuser -k 3001/tcp ; echo "${process.env.SINCO_SSH_PASSWORD}" | sudo -S killall -9 node ; npx pm2 start metalfisa_producao`, (err, stream) => {
        stream.on('close',()=>{conn.end()}).on('data', d=>console.log('REMOTE POST CONTENT:', d.toString()));
    });
}).connect({ host: '192.168.1.77', username: 'sinco', password: process.env.SINCO_SSH_PASSWORD, port: 22 });
