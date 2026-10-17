const fs = require('fs');
const path = 'c:\\Users\\adm\\Desktop\\MetalFisa Anty\\server\\routes\\sinco_apontamento.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Atualizar query params
content = content.replace(
    'const { q } = req.query || {};',
    'const { q, projeto, tag } = req.query || {};'
);

// 2. Atualizar lógica extraWhere
content = content.replace(
    /extraWhere = ' AND \(i\.CodMatFabricante LIKE \? OR i\.DescResumo LIKE \?\)'/,
    "extraWhere += ' AND (i.CodMatFabricante LIKE ? OR i.DescResumo LIKE ?)'"
);

// 3. Adicionar filtros projeto/tag
content = content.replace(
    /params\.push\(`%\${q}%`, `%\${q}%`\);\s+}/,
    "params.push(`%${q}%`, `%${q}%`);\n        }\n        if (projeto) {\n            extraWhere += ' AND i.Projeto LIKE ?';\n            params.push(`%${projeto}%`);\n        }\n        if (tag) {\n            extraWhere += ' AND i.Tag LIKE ?';\n            params.push(`%${tag}%`);\n        }"
);

// 4. Adicionar colunas ao SELECT
content = content.replace(
    'i.CodMatFabricante,',
    'i.CodMatFabricante,\n                i.Projeto,\n                i.Tag,'
);

fs.writeFileSync(path, content);
console.log('✅ Backend atualizado com sucesso.');
