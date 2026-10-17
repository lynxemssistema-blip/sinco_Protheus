const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'config', 'helpContent.js');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
  /'\ud83d\udda8\ufe0f \*\*Impressão Ágil\*\*: Na listagem geral de pedidos, o Menu de Ações \(três pontinhos\) permite opções complexas como imprimir Espelhos de OP integrando Desenhos automaticamente\.',/g,
  "'\ud83d\udda8\ufe0f **Impressão Ágil**: Na listagem geral de pedidos, o Menu de Ações (três pontinhos) permite opções complexas como imprimir Espelhos de OP integrando Desenhos automaticamente.',\n      '?? **Assistente Hermes (PCPMetal)**: Use o chat do Hermes na Visão Geral para analisar rapidamente. Pergunte: \"Quais pedidos filtrados estão atrasados?\" ou \"Gere um resumo do que falta faturar na tela\". Ele lê os dados da tela para ajudar.',"
);

text = text.replace(
  /'O filtro "Com saldo pendente" é o padrão recomendado: mantém a lista limpa, mostrando apenas o que ainda precisa de atenção do PCP\.',/g,
  "'O filtro \"Com saldo pendente\" é o padrão recomendado: mantém a lista limpa, mostrando apenas o que ainda precisa de atenção do PCP.',\n      '?? **Planejamento Autônomo com Hermes**: Abra o chat do Hermes (PCPMetal) nesta tela e diga \"Planeje todas as OPs da tela com capacidade infinita\" ou \"Qual a máquina com maior gargalo atual?\" Ele pode executar o motor de planejamento sozinho e auditar os atrasos.',"
);

fs.writeFileSync(p, text, 'utf8');
console.log('Updated helpContent.js successfully!');
