const fs = require('fs');
const path = require('path');

const filePath = path.join('server', 'routes', 'producao.js');
let code = fs.readFileSync(filePath, 'utf8');

const targetStr = "    const hasMore = finalList.length >= limit;";

const newStr = `    finalList.sort((a, b) => {
      const dateA = a.planejamento_inicio ? new Date(a.planejamento_inicio).getTime() : Infinity;
      const dateB = b.planejamento_inicio ? new Date(b.planejamento_inicio).getTime() : Infinity;
      return dateA - dateB;
    });

    const hasMore = finalList.length >= limit;`;

code = code.replace(targetStr, newStr);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Backend sort updated');
