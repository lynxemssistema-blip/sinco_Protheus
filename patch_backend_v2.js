const fs = require('fs');
const path = 'c:\\Users\\adm\\Desktop\\MetalFisa Anty\\server\\routes\\sinco_apontamento.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Matrix SELECT
content = content.replace(
    /(\/\/\s*GET\s*\/api\/sinco-apontamento\/os\/:osId\/matrix[\s\S]*?SELECT\s+[\s\S]*?i\.IdOrdemServicoItem,\s+i\.Nivel,\s+)i\.CodMatFabricante,/,
    '$1i.CodMatFabricante, i.Projeto, i.Tag,'
);

// 2. Materials SELECT
content = content.replace(
    /(\/\/\s*GET\s*\/api\/sinco-apontamento\/os\/:osId\/materials[\s\S]*?SELECT\s+[\s\S]*?i\.IdOrdemServicoItem,\s+i\.Nivel,\s+)i\.CodMatFabricante,/,
    '$1i.CodMatFabricante, i.Projeto, i.Tag,'
);

// 3. Matrix Mapping (Ensure Projeto/Tag are in itemsMap)
if (!content.includes('Projeto: r.Projeto,')) {
    content = content.replace(
        'CodMatFabricante: r.CodMatFabricante,',
        'CodMatFabricante: r.CodMatFabricante,\n                    Projeto: r.Projeto,\n                    Tag: r.Tag,'
    );
}

fs.writeFileSync(path, content);
console.log('✅ Backend (Matrix & Materials) atualizado com sucesso.');
