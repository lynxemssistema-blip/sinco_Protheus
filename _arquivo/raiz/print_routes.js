const { Client } = require('ssh2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const conn = new Client();
conn.on('ready', () => {
    conn.exec('cd /var/www/metalfisa/server && node -e "const r = require(\'./routes/faturamento.js\'); console.log(r.stack.map(layer => layer.route ? Object.keys(layer.route.methods)[0].toUpperCase() + \' \' + layer.route.path : \'???\'));"', (err, stream) => {
        stream.on('close', () => conn.end()).on('data', d => console.log('🔴 ROTAS NA MEMÓRIA:', d.toString())).stderr.on('data', d => console.error(d.toString()));
    });
}).connect({ host: '192.168.1.77', username: 'sinco', password: process.env.SINCO_SSH_PASSWORD, port: 22 });
