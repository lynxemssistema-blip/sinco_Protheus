const fs = require('fs');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace \` with `
    content = content.replace(/\\`/g, '`');
    // Replace \$ with $
    content = content.replace(/\\\$/g, '$');
    fs.writeFileSync(filePath, content);
}

fixFile('server/index.js');
fixFile('server/routes/meucanal.js');
