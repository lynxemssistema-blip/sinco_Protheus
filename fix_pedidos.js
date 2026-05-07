const fs = require('fs');
let content = fs.readFileSync('server/routes/pedidos.js', 'utf8');

// Replace all instances of REPLACE(TRIM(x), ' ', '') with TRIM(x)
// For example: REPLACE(TRIM(g1.g1_comp), ' ', '') -> TRIM(g1.g1_comp)
const regex = /REPLACE\(\s*TRIM\(([^)]+)\)\s*,\s*' '\s*,\s*''\s*\)/g;
content = content.replace(regex, 'TRIM($1)');

fs.writeFileSync('server/routes/pedidos.js', content, 'utf8');
console.log('Fixed pedidos.js');
