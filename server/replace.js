const fs = require('fs');
let content = fs.readFileSync('routes/reports.js', 'utf8');

const target1 =             // Merge PCP data into itemsMap
            Object.values(itemsMap).forEach(itemList => {
                itemList.forEach(it => {
                    const k = \\_\\;
                    const pcp = pcpMap[k];
                    it.data_pcp   = pcp ? pcp.data_entrega_pcp : null;
                    it.qtde_pcp   = pcp ? parseFloat(pcp.quantidade_pcp) : null;
                });
            });
        };

const rep1 = target1 + 
        
        // --- INÍCIO BUSCA DE PRIORIDADES DE OP ---
        try {
            const opNumerosUnicos = [];
            Object.values(itemsMap).forEach(itemList => {
                itemList.forEach(it => {
                    if (it.op) opNumerosUnicos.push(it.op);
                });
            });
            const opsToCheck = [...new Set(opNumerosUnicos)];

            if (opsToCheck.length > 0) {
                const placeholders = opsToCheck.map(() => '?').join(',');
                const [opPrioritiesRows] = await mysqlPool.query(
                    \SELECT op_numero, prioridade FROM app_op_priorities WHERE op_numero IN (\)\,
                    opsToCheck
                );
                const priorityMap = {};
                opPrioritiesRows.forEach(r => { priorityMap[r.op_numero] = r.prioridade; });
                
                Object.values(itemsMap).forEach(itemList => {
                    itemList.forEach(it => {
                        const op = it.op;
                        if (!op) {
                            it.op_prioridade = 0;
                            return;
                        }
                        const prefix = op.substring(0, 8);
                        it.op_prioridade = priorityMap[op] || priorityMap[prefix] || 0;
                    });
                });
            } else {
                Object.values(itemsMap).forEach(itemList => {
                    itemList.forEach(it => { it.op_prioridade = 0; });
                });
            }
        } catch (err) {
            console.error('[OP PRIORITY FETCH ERROR in fetchSalesPlanningData]', err);
            Object.values(itemsMap).forEach(itemList => {
                itemList.forEach(it => { it.op_prioridade = 0; });
            });
        }
        // --- FIM BUSCA DE PRIORIDADES DE OP ---;

const target2 =             { header: 'NF Número', key: 'nf_nota', width: 15 },
            { header: 'Qtd Faturada', key: 'nf_qtd', width: 15 },
            { header: 'Saldo Item', key: 'saldo', width: 15 }
        ];;

const rep2 =             { header: 'NF Número', key: 'nf_nota', width: 15 },
            { header: 'Qtd Faturada', key: 'nf_qtd', width: 15 },
            { header: 'Saldo Item', key: 'saldo', width: 15 },
            { header: 'Prioridade', key: 'prioridade', width: 15 }
        ];;

const target3 =                 order.itens.forEach(item => {
                    const saldo = parseFloat(item.qtd_faturar) || 0;
                    
                    if (item.notas_fiscais && item.notas_fiscais.length > 0) {;

const rep3 =                 order.itens.forEach(item => {
                    const saldo = parseFloat(item.qtd_faturar) || 0;
                    const priorityMapping = { 1: 'Urgente', 2: 'Alta', 3: 'Média', 4: 'Normal' };
                    const priorityStr = item.op_prioridade ? \Grupo \ (\)\ : '-';
                    
                    if (item.notas_fiscais && item.notas_fiscais.length > 0) {;

const target4 =                                 nf_emissao: nf.emissao,
                                nf_nota: nf.nota,
                                nf_qtd: parseFloat(nf.qtd),
                                saldo: saldo
                            });;

const rep4 =                                 nf_emissao: nf.emissao,
                                nf_nota: nf.nota,
                                nf_qtd: parseFloat(nf.qtd),
                                saldo: saldo,
                                prioridade: priorityStr
                            });;

const target5 =                             nf_emissao: 'Sem NF',
                            nf_nota: '-',
                            nf_qtd: 0,
                            saldo: saldo
                        });;

const rep5 =                             nf_emissao: 'Sem NF',
                            nf_nota: '-',
                            nf_qtd: 0,
                            saldo: saldo,
                            prioridade: priorityStr
                        });;

content = content.replace(target1, rep1);
content = content.replace(target1.replace(/\n/g, '\r\n'), rep1.replace(/\n/g, '\r\n'));

content = content.replace(target2, rep2);
content = content.replace(target2.replace(/\n/g, '\r\n'), rep2.replace(/\n/g, '\r\n'));

content = content.replace(target3, rep3);
content = content.replace(target3.replace(/\n/g, '\r\n'), rep3.replace(/\n/g, '\r\n'));

content = content.replace(target4, rep4);
content = content.replace(target4.replace(/\n/g, '\r\n'), rep4.replace(/\n/g, '\r\n'));

content = content.replace(target5, rep5);
content = content.replace(target5.replace(/\n/g, '\r\n'), rep5.replace(/\n/g, '\r\n'));

fs.writeFileSync('routes/reports.js', content);
console.log('Done!');
