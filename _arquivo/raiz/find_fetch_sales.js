const fs = require('fs');
const content = fs.readFileSync('server/routes/reports.js', 'utf8');
const lines = content.split('\n');

const match = lines.findIndex(l => l.includes('function fetchSalesPlanningData') || l.includes('const fetchSalesPlanningData'));
if (match !== -1) {
    console.log(lines.slice(match, match + 50).join('\n'));
} else {
    console.log('Not found');
}
