const fs = require('fs');

const content = fs.readFileSync('../server/routes/pedidos.js', 'utf8');
const lines = content.split('\n');

console.log('Searching for flat in server/routes/pedidos.js...');
lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('flat')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
