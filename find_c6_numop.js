const fs = require('fs');
const content = fs.readFileSync('server/routes/reports.js', 'utf8');
const lines = content.split('\n');

const match = lines.findIndex(l => l.includes('SELECT') && l.includes('c6_numop'));
if (match !== -1) {
    console.log(lines.slice(match - 5, match + 30).join('\n'));
} else {
    console.log('Not found');
}
