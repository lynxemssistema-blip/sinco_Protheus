const fs = require('fs');
const content = fs.readFileSync('server/routes/reports.js', 'utf8');
const lines = content.split('\n');

const match = lines.findIndex(l => l.includes('const itemsQuery = `'));
if (match !== -1) {
    console.log(lines.slice(match, match + 50).join('\n'));
} else {
    const backupMatch = lines.findIndex((l, i) => i > 400 && l.includes('SELECT') && l.includes('c6.c6_item'));
    console.log(lines.slice(backupMatch - 5, backupMatch + 30).join('\n'));
}
