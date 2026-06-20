const fs = require('fs');
const path = require('path');

const filePath = path.join('server', 'services', 'geminiPcpService.js');
let code = fs.readFileSync(filePath, 'utf8');

const promptInjection = `
=== TOP 100 PECAS MAIS CONSUMIDORAS DA CAPACIDADE ===
\${secaoTop100}
`;

code = code.replace("=== GARGALOS DETECTADOS", promptInjection + "=== GARGALOS DETECTADOS");

const instrucaoCritica = `
INSTRUCAO CRITICA:
Gere uma analise estritamente SUCINTA, TECNICA E CRITICA.
Foque no TOP 100 acima. Ha indicios de superdimensionamento de tempo? Ha alguma peca monopolizando um recurso especifico? Aponte diretamente os problemas e não gaste palavras com saudacoes ou explicacoes teoricas. Mostre o que precisa ser revisto na engenharia ou no PCP.
`;

code = code.replace("=== INSTRU", instrucaoCritica + "\n=== INSTRU");

fs.writeFileSync(filePath, code, 'utf8');
console.log('geminiPcpService.js updated 2!');
