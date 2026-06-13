const fs = require('fs');
const path = require('path');

const reportData = JSON.parse(fs.readFileSync('audit_report.json', 'utf8'));

// Categorize
const todos = [];
const commented = [];
const unusedFrontend = [];
const unusedBackendScripts = [];

reportData.forEach(item => {
    // Collect TODOs
    if (item.todos > 0) {
        todos.push(item);
    }
    
    // Collect Commented blocks
    if (item.commentedBlocks > 0) {
        commented.push(item);
    }
    
    // Collect unused files
    if (item.isPotentiallyUnused) {
        if (item.file.startsWith('client')) {
            unusedFrontend.push(item);
        } else if (item.file.startsWith('server')) {
            unusedBackendScripts.push(item);
        }
    }
});

// Sort
todos.sort((a, b) => b.todos - a.todos);
commented.sort((a, b) => b.commentedBlocks - a.commentedBlocks);
unusedFrontend.sort((a, b) => a.file.localeCompare(b.file));
unusedBackendScripts.sort((a, b) => a.file.localeCompare(b.file));

// Build markdown
let md = `# 🚀 Relatório de Análise e Auditoria do Código

Análise técnica profunda realizada em todo o projeto MetalFisa (Client & Server) para identificar pendências (TODOs), blocos comentados e arquivos órfãos.

## ⚠️ 1. Arquivos com pendências de desenvolvimento (TODOs / FIXMEs)
Estes arquivos contêm comentários de melhoria pendente.

| Arquivo | Quantidade de TODOs |
| :--- | :---: |
${todos.map(t => `| \`${t.file}\` | **${t.todos}** |`).join('\n')}

---

## 🗑️ 2. Blocos de Código Comentados (Código Morto / Inativo)
Arquivos que contêm blocos inativos (importações, variáveis ou funções comentadas com \`//\`).

| Arquivo | Blocos Inativos (Linhas) |
| :--- | :---: |
${commented.map(c => `| \`${c.file}\` | **${c.commentedBlocks}** |`).join('\n')}

---

## 👻 3. Componentes/Arquivos Frontend Potencialmente Órfãos (Não Importados)
Arquivos localizados no diretório \`client/src\` que não possuem importação estática ou dinâmica mapeada no código-fonte principal. Podem ser resquícios de arquivos antigos.

| Arquivo Frontend | Status |
| :--- | :--- |
${unusedFrontend.map(u => `| \`${u.file}\` | ⚠️ Potencialmente Sem Uso |`).join('\n')}

---

## 🛠️ 4. Scripts e Utilitários de Backend Autônomos (Sem Importação Direta)
Estes scripts residem no diretório \`server/\` e são executados de forma manual/avulsa (migrations, checagens de banco de dados, scripts de suporte). Não são importados pelo servidor Express principal, o que é o comportamento esperado.

| Script de Backend | Função Estimada |
| :--- | :--- |
${unusedBackendScripts.map(u => `| \`${u.file}\` | Script Utilitário / Migração |`).join('\n')}
`;

fs.writeFileSync('relatorio_auditoria_app.md', md);
console.log('Markdown report generated successfully.');
