const { Client } = require('ssh2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const conn = new Client();
conn.on('ready', () => {
    conn.exec('pm2 logs metalfisa_producao --lines 100 --nostream', (err, stream) => {
        stream.on('close', () => conn.end()).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString()));
    });
}).connect({ host: '192.168.1.77', username: 'sinco', password: process.env.SINCO_SSH_PASSWORD, port: 22 });
