const fs = require('fs');
const content = fs.readFileSync('server/routes/reports.js', 'utf8');
const lines = content.split('\n');

const match = lines.findIndex(l => l.includes('function fetchSalesPlanningData'));
if (match !== -1) {
    console.log(match);
} else {
    console.log('Not found');
}
