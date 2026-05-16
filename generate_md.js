const fs = require('fs');
const r = require('./audit_report.json').filter(x => !x.file.includes('node_modules'));

let md = '# 🚀 Relatório Profundo de Auditoria do App\n\n';
md += 'Análise técnica em todo o projeto MetalFisa (Client & Server) para identificar peso morto, TODOs esquecidos, lixo de código e arquivos soltos.\n\n';

const todos = r.filter(x => x.todos > 0).sort((a,b) => b.todos - a.todos).slice(0, 30);
md += '## ⚠️ 1. Arquivos com maior concentração de TODOs e FIXMEs\n';
md += '| Arquivo | Qtd |\n|---|---|\n';
todos.forEach(x => { md += `| ${x.file} | ${x.todos} |\n`; });

const commented = r.filter(x => x.commentedBlocks > 2).sort((a,b) => b.commentedBlocks - a.commentedBlocks).slice(0, 30);
md += '\n## 🗑️ 2. Lixo de Código (Blocos comentados // const, // function)\n';
md += '| Arquivo | Blocos Inativos (Aprox) |\n|---|---|\n';
commented.forEach(x => { md += `| ${x.file} | ${x.commentedBlocks} |\n`; });

const unused = r.filter(x => x.isPotentiallyUnused && !x.file.includes('routes') && !x.file.includes('index.js')).slice(0, 50);
md += '\n## 👻 3. Componentes/Arquivos Potencialmente Órfãos (Não Importados)\n';
md += '| Arquivo (Top 50) | Status |\n|---|---|\n';
unused.forEach(x => { md += `| ${x.file} | Órfão |\n`; });

fs.writeFileSync('relatorio_auditoria_app.md', md);
console.log('Artifact saved.');
