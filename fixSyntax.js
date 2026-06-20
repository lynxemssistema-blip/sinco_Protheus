const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(/className=\{w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all \\\}/g, 'className={\w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all \\}');

fs.writeFileSync(p, text, 'utf8');
console.log('Syntax fixed!');
