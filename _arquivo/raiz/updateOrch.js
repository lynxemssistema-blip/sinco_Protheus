const fs = require('fs');
const path = require('path');
const p = path.join('server', 'services', 'pcpmetal', 'orchestrator.js');
let text = fs.readFileSync(p, 'utf8');

// Replace analystQuestion
const oldAnalystQ = 'const analystQuestion = Pergunta do usu\u00e1rio: "\"\\\n\\nGenere as consultas SQL necess\u00e1rias para obter TODOS os dados relevantes para responder essa pergunta. Execute no m\u00e1ximo \ consultas. Formato: \\\\\\\\\sql\\n[BANCO: postgresql ou mysql]\\nSELECT...\\n\\\\\\\\\`;';

const newAnalystQ = 'const analystQuestion = Pergunta do usu\u00e1rio: "\"\\\n\\nGenere as consultas SQL necess\u00e1rias para responder a essa pergunta. Se o usu\u00e1rio pedir para alterar ou atualizar dados, voc\u00ea pode gerar comandos UPDATE, INSERT ou DELETE apenas no banco MySQL. Formato: \\\\\\\\\sql\\n[BANCO: postgresql ou mysql]\\nSELECT ou UPDATE...\\n\\\\\\\\\`;';

text = text.replace(oldAnalystQ, newAnalystQ);

// Replace sql execution
const oldExec = '                const result = await runQuery(banco, sql);\n' +
                '                queryResults.push({ banco, sql, rows: result.rows, rowCount: result.rowCount, error: null });\n' +
                '                executedSQLs.push({ banco, sql, rowCount: result.rowCount });\n' +
                '                send({ type: \\'step\\', icon: \\'\\ud83d\\udd0e\\', message: Consulta \ retornou **\** linha(s) });';

const newExec =                 const isDml = /^(UPDATE|INSERT|DELETE)\\s/i.test(sql.trim());
                const permissionGranted = /(autorizado|pode fazer|pode executar|aprovo|sim|atualize|execute|confirmo)/i.test(userMessage);

                if (isDml && !permissionGranted) {
                    const msg = 'SQL de altera\u00e7\u00e3o gerado, aguardando permiss\u00e3o do usu\u00e1rio.';
                    queryResults.push({ banco, sql, rows: [{ aviso: msg }], rowCount: 0, error: null });
                    executedSQLs.push({ banco, sql, aviso: msg });
                    send({ type: 'step', icon: '\u26a0\ufe0f', message: \Consulta \ (DML) requer autoriza\u00e7\u00e3o para executar.\ });
                } else if (isDml && banco === 'postgresql') {
                    const msg = 'N\u00e3o \u00e9 permitido executar altera\u00e7\u00f5es no Protheus (PostgreSQL).';
                    queryResults.push({ banco, sql, rows: [{ erro: msg }], rowCount: 0, error: msg });
                    executedSQLs.push({ banco, sql, error: msg });
                    send({ type: 'step', icon: '\u274c', message: \Consulta \ bloqueada: \\ });
                } else {
                    const result = await runQuery(banco, sql);
                    queryResults.push({ banco, sql, rows: result.rows, rowCount: result.rowCount, error: null });
                    executedSQLs.push({ banco, sql, rowCount: result.rowCount });
                    send({ type: 'step', icon: '\\ud83d\\udd0e', message: \Consulta \ retornou **\** linha(s)\ });
                };

text = text.replace(oldExec, newExec);

fs.writeFileSync(p, text, 'utf8');
console.log('Script ran successfully');
