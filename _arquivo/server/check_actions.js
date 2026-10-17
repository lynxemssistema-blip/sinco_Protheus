const fs = require('fs');
const actions = JSON.parse(fs.readFileSync('analysis_actions.json'));
const items = ['71', '91', '9B'];
const found = actions.filter(a => items.includes(a.item));
console.log('Items 71, 91, 9B in actions:', found.length);
