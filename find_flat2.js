const fs = require('fs');
const content = fs.readFileSync('client/src/components/OrdersTable.jsx', 'utf8');

const lines = content.split('\n');
const match = lines.findIndex(l => l.includes('viewMode === \'flat\' ? ('));
if (match !== -1) {
    console.log(lines.slice(match - 2, match + 40).join('\n'));
} else {
    console.log('Not found');
}
