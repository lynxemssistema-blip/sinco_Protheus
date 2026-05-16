const fs=require('fs');
let c=fs.readFileSync('server/routes/pedidos.js','utf8');
c=c.replace(/\\'/g, "'");
fs.writeFileSync('server/routes/pedidos.js',c);
