// Script para liberar conexões idle via HTTP endpoint no servidor
// O servidor já tem uma conexão PG aberta — podemos usá-la para limpar as outras
const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/producao/pg-cleanup',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try { console.log('Resposta:', JSON.parse(data)); }
    catch { console.log('Resposta raw:', data); }
    process.exit(0);
  });
});
req.on('error', e => { console.error('HTTP error:', e.message); process.exit(1); });
req.end();
