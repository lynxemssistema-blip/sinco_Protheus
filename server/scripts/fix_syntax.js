const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/production.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the garbage line with spaces
const lines = content.split('\n');
const cleanLines = lines.filter(line => !line.includes('c o n s o l e'));

// Ensure clean export and new log
const finalContent = cleanLines.join('\n').replace(
    'module.exports = router;',
    "module.exports = router;\nconsole.log('DEBUG: Production module loaded');"
);

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('✅ Arquivo corrigido com sucesso!');
