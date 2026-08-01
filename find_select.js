const fs = require('fs');
const content = fs.readFileSync('server/routes/reports.js', 'utf8');
const lines = content.split('\n');

const match = lines.findIndex(l => l.includes('const itemsQuery = `') || l.includes('SELECT') && l.includes('c6.c6_item'));
if (match !== -1) {
    console.log(lines.slice(match - 5, match + 40).join('\n'));
} else {
    // If not found, try to find where it selects items
    const altMatch = lines.findIndex((l, i) => i > 250 && l.includes('SELECT') && l.includes('c6'));
    console.log(lines.slice(altMatch - 5, altMatch + 40).join('\n'));
}
