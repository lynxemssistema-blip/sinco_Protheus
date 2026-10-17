const fs = require('fs');
const path = require('path');
const p = path.join('server', 'services', 'pcpmetal', 'orchestrator.js');
let text = fs.readFileSync(p, 'utf8');

const regexAnalystQuestion = /const analystQuestion = Pergunta do usuário: "\$\{userMessage\}"\$\{historyContext\}\\n\\nGenere as consultas SQL.*;/;

const newAnalystQuestion = "const analystQuestion = Pergunta do usuário: \"\\"\\\n\\nGenere as consultas SQL necessárias. Se o usuário pedir para alterar ou atualizar, você pode gerar UPDATE/INSERT/DELETE no banco MySQL. Formato: \\\\\\\\\sql\\n[BANCO: postgresql ou mysql]\\nSELECT ou UPDATE...\\n\\\\\\\\\`;";

text = text.replace(regexAnalystQuestion, newAnalystQuestion);

// Now for the SQL execution block
const regexExecute = /const result = await runQuery\(banco, sql\);/;

const newExecute = 
                const isDml = /^(UPDATE|INSERT|DELETE)\\s/i.test(sql.trim());
                const permissionGranted = /(autorizado|pode fazer|pode executar|aprovo|sim|atualize|execute|confirmo)/i.test(userMessage);
                
                let result;
                if (isDml && !permissionGranted) {
                    // Não executa, apenas passa para o estrategista pedir permissão
                    result = { rows: [{ aviso: 'SQL DML gerado mas NÃO executado. O Estrategista deve mostrar o comando SQL ao usuário e pedir permissão explícita para executar.' }], rowCount: 0 };
                    send({ type: 'step', icon: '??', message: \Consulta \ requer confirmação do usuário (UPDATE/INSERT/DELETE)\ });
                } else if (isDml && banco === 'postgresql') {
                    result = { rows: [{ error: 'Não é permitido fazer alterações no Protheus (PostgreSQL)' }], rowCount: 0 };
                } else {
                    result = await runQuery(banco, sql);
                }
;

text = text.replace(regexExecute, newExecute);

fs.writeFileSync(p, text, 'utf8');
console.log('Updated orchestrator.js to support DML and permissions!');
