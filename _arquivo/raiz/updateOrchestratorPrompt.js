const fs = require('fs');
const path = require('path');
const p = path.join('server', 'services', 'pcpmetal', 'orchestrator.js');
let text = fs.readFileSync(p, 'utf8');

const regexStrategistQ = /const finalQuestion = Pergunta original.*?;/g;

const newStrategistQ = "const finalQuestion = Pergunta original: \"\\"\\\n\\n\\\n\\nResponda diretamente à pergunta do usuário em Português (Brasil). Importante: (1) O seu estilo de conversa deve ser como num bate-papo, natural e contextualizado. (2) Se o usuário pedir expressamente um 'relatório técnico', gere um relatório completo em Markdown. Caso contrário, apenas responda o que foi perguntado de forma clara e fluída. (3) Sempre que solicitado, ofereça sugestões ou ideias estratégicas de como ajustar o planejamento da produção ou resolver o problema detectado.;";

text = text.replace(regexStrategistQ, newStrategistQ);

fs.writeFileSync(p, text, 'utf8');
console.log('Orchestrator prompt updated!');
