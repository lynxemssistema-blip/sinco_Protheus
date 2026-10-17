const fs = require('fs');
const content = fs.readFileSync('client/src/components/orders/FlatItemRow.jsx', 'utf8');

const lines = content.split('\n');
const match = lines.findIndex(l => l.includes('G1') || l.includes('G2') || l.includes('G') || l.includes('priority'));
if (match !== -1) {
    console.log(lines.slice(match - 5, match + 30).join('\n'));
} else {
    console.log('Not found');
}
