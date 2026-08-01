const fs = require('fs');
const content = fs.readFileSync('client/src/components/MasterSheetTab.jsx', 'utf8');

const lines = content.split('\n');
const match = lines.findIndex(l => l.includes('op_prioridade'));
if (match !== -1) {
    console.log(lines.slice(match - 5, match + 15).join('\n'));
} else {
    console.log('Not found');
}
