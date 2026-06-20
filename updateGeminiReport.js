const fs = require('fs');
const path = require('path');

const filePath = path.join('server', 'services', 'geminiPcpService.js');
let code = fs.readFileSync(filePath, 'utf8');

const top100Section = `
    // -- Secao TOP 100 Pecas Consumidoras --
    const top100 = report.top_100_pecas_gargalo || [];
    const secaoTop100 = top100.length > 0
        ? top100.map((p, i) => \`\${i+1}. [\${p.recurso}] Peca: \${p.produto} - Qtd: \${p.quantidade_total} | Tempo Total: \${Math.round(p.tempo_total_min)}min | Unitário: \${p.tempo_unitario_min}min\`).join('\\n')
        : '  Nenhuma peca consumidora detectada.';
`;

// Replace using generic text that we know is in the file based on the previous get-content
code = code.replace("    // --", top100Section + "\n    // --");

const promptInjection = `
--- RELATORIO TECNICO DE CAPACIDADE (TOP 100 PECAS) ---
Abaixo estao as 100 pecas que mais estao ocupando a capacidade produtiva neste planejamento:
\`\`\`text
\${secaoTop100}
\`\`\`
INSTRUCAO CRITICA:
Gere uma analise estritamente SUCINTA, TECNICA E CRITICA.
Foque nas pecas acima. Ha indicios de superdimensionamento de tempo? Ha alguma peca monopolizando um recurso especifico? Aponte diretamente os problemas e não gaste palavras com saudacoes ou explicacoes teoricas. Mostre o que precisa ser revisto na engenharia ou no PCP.
`;

// we will append this right before returning prompt
code = code.replace("    return prompt;", promptInjection + "\n    return prompt;");

fs.writeFileSync(filePath, code, 'utf8');
console.log('geminiPcpService.js updated!');
