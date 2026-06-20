const fs = require('fs');
const path = require('path');

const filePath = path.join('server', 'services', 'fcsEngine.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add top parts collection during PRE-ESTUDO
const preEstudoTarget = "const demandaPorRecurso = {};";
const preEstudoRepl = `const demandaPorRecurso = {};
        const demandaPorPeca = {};`;

code = code.replace(preEstudoTarget, preEstudoRepl);

const demandaAddTarget = "demandaPorRecurso[rot.recurso] += qtdPend * rot.tempoMinutos;";
const demandaAddRepl = `demandaPorRecurso[rot.recurso] += qtdPend * rot.tempoMinutos;
                
                // Agrupar por peça e recurso para o Top 100
                const keyPeca = \`\${op.produto}||\${rot.recurso}\`;
                if (!demandaPorPeca[keyPeca]) {
                    demandaPorPeca[keyPeca] = {
                        produto: op.produto,
                        descricao: op.produto_desc,
                        recurso: rot.recurso,
                        desc_recurso: descRecursoMap[rot.recurso] || rot.recurso,
                        quantidade_total: 0,
                        tempo_total_min: 0,
                        tempo_unitario_min: rot.tempoMinutos
                    };
                }
                demandaPorPeca[keyPeca].quantidade_total += qtdPend;
                demandaPorPeca[keyPeca].tempo_total_min += (qtdPend * rot.tempoMinutos);`;

code = code.replace(demandaAddTarget, demandaAddRepl);

// 2. Sort and extract top 100 inside the report generation block
const reportTarget = `const report = {
            gerado_em: new Date().toISOString(),`;
            
const reportRepl = `
        const top100PecasGargalo = Object.values(demandaPorPeca)
            .filter(p => p.tempo_total_min > 0)
            .sort((a, b) => b.tempo_total_min - a.tempo_total_min)
            .slice(0, 100);

        const report = {
            top_100_pecas_gargalo: top100PecasGargalo,
            gerado_em: new Date().toISOString(),`;

code = code.replace(reportTarget, reportRepl);

fs.writeFileSync(filePath, code, 'utf8');
console.log('fcsEngine.js updated successfully!');
