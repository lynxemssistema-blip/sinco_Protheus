const fs = require('fs');
const content = fs.readFileSync('client/src/components/OrdersTable.jsx', 'utf8');

const lines = content.split('\n');
console.log(lines.filter(l => l.includes('import')).join('\n'));
