const r = require('../_arquivo_morto/analise_indices.json');
const lower = a => a.map(x => x.toLowerCase());
console.log('== SEM IdEmpresa lider ==');
console.log(r.filter(x => lower(x.candidates).includes('idempresa')).map(x => `${x.table}(${x.rows}) idx=${JSON.stringify(x.indexes)}`).join('\n'));
console.log('== SEM indice secundario ==');
console.log(r.filter(x => x.noSecondaryIndex).map(x => `${x.table} cand=${x.candidates}`).join('\n'));
console.log('== chave de negocio sem indice ==');
const key = /^(pedido|item|codigo|produto|usuario_id|user_id|recurso_codigo|solicitacao_id|asset_id|id_maquina|situacao|cliente_nome|cliente)$/i;
r.filter(x => x.candidates.some(c => key.test(c))).forEach(x => console.log(`${x.table}: cand=${x.candidates.filter(c => key.test(c) || /status|data_/i.test(c))} | idx=${Object.entries(x.indexes).map(([k, v]) => k + '(' + v + ')').join(' ; ')}`));
