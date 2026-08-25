const fs = require('fs');
const path = require('path');
const files = ['server/routes/protheus.js', 'server/routes/sinco.js', 'server/routes/faturamento.js'];

files.forEach(f => {
    let p = path.join(process.cwd(), f);
    let c = fs.readFileSync(p, 'utf8');
    
    // Fix single quote string termination
    c = c.replace(/password=Metal1120@;/g, "password=Metal1120@';");
    
    // Fix backtick string termination
    c = c.replace(/password=Metal1120@`,/g, "password=Metal1120@`,");
    
    fs.writeFileSync(p, c);
});
console.log('Fixed syntax errors.');
