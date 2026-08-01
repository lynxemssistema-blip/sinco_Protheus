const fs = require('fs');
const content = fs.readFileSync('client/src/components/OrdersTable.jsx', 'utf8');

const lines = content.split('\n');
// Find where viewMode === 'flat' rendering happens
const flatRenderStart = lines.findIndex(l => l.includes('order.item ? `') && l.includes('order.pedido'));
if (flatRenderStart !== -1) {
    console.log(lines.slice(flatRenderStart - 20, flatRenderStart + 20).join('\n'));
} else {
    console.log('Not found');
}
