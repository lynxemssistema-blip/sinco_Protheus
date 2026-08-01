const fs = require('fs');
const content = fs.readFileSync('client/src/components/OrdersTable.jsx', 'utf8');

const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('order.pedido') && l.includes('<td'));
if (start !== -1) {
    console.log(lines.slice(start - 5, start + 30).join('\n'));
} else {
    console.log('Not found');
}
