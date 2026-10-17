const fs = require('fs');
const filePath = 'server/routes/reports.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix TRIM in sc2010 join
const targetTrim = "                LEFT JOIN sc2010 c2\r\n                    ON c2.c2_pedido = c6.c6_num\r\n                    AND c2.c2_itempv = c6.c6_item";
const replaceTrim = "                LEFT JOIN sc2010 c2\r\n                    ON TRIM(c2.c2_pedido) = TRIM(c6.c6_num)\r\n                    AND TRIM(c2.c2_itempv) = TRIM(c6.c6_item)";
const targetTrimLF = "                LEFT JOIN sc2010 c2\n                    ON c2.c2_pedido = c6.c6_num\n                    AND c2.c2_itempv = c6.c6_item";
const replaceTrimLF = "                LEFT JOIN sc2010 c2\n                    ON TRIM(c2.c2_pedido) = TRIM(c6.c6_num)\n                    AND TRIM(c2.c2_itempv) = TRIM(c6.c6_item)";

if (content.includes(targetTrim)) content = content.replace(targetTrim, replaceTrim);
else if (content.includes(targetTrimLF)) content = content.replace(targetTrimLF, replaceTrimLF);

// 2. Fix masterSheet.itens.push to include op_prioridade
const targetPush = "ped_cli: item.ped_cli\r\n                    });";
const replacePush = "ped_cli: item.ped_cli,\r\n                        op_prioridade: item.op_prioridade\r\n                    });";
const targetPushLF = "ped_cli: item.ped_cli\n                    });";
const replacePushLF = "ped_cli: item.ped_cli,\n                        op_prioridade: item.op_prioridade\n                    });";

if (content.includes(targetPush)) content = content.replace(targetPush, replacePush);
else if (content.includes(targetPushLF)) content = content.replace(targetPushLF, replacePushLF);

// 3. Fix Priority Items Filter
const targetVar = "const prioVal = filters.prioridade || filters.somente_prioridades;\r\n    if (prioVal && prioVal !== 'false') {";
const replaceVar = "let priFilterItems = '';\r\n    const prioVal = filters.prioridade || filters.somente_prioridades;\r\n    if (prioVal && prioVal !== 'false') {";
const targetVarLF = "const prioVal = filters.prioridade || filters.somente_prioridades;\n    if (prioVal && prioVal !== 'false') {";
const replaceVarLF = "let priFilterItems = '';\n    const prioVal = filters.prioridade || filters.somente_prioridades;\n    if (prioVal && prioVal !== 'false') {";

if (content.includes(targetVar)) content = content.replace(targetVar, replaceVar);
else if (content.includes(targetVarLF)) content = content.replace(targetVarLF, replaceVarLF);

const targetAssign = "const priFilterCount = ` AND (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${tuplePlaceholdersCount.join(', ')}) `;\r\n            whereClause += priFilterCount;";
const replaceAssign = "const priFilterCount = ` AND (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${tuplePlaceholdersCount.join(', ')}) `;\r\n            priFilterItems = priFilterCount;\r\n            whereClause += priFilterCount;";
const targetAssignLF = "const priFilterCount = ` AND (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${tuplePlaceholdersCount.join(', ')}) `;\n            whereClause += priFilterCount;";
const replaceAssignLF = "const priFilterCount = ` AND (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${tuplePlaceholdersCount.join(', ')}) `;\n            priFilterItems = priFilterCount;\n            whereClause += priFilterCount;";

if (content.includes(targetAssign)) content = content.replace(targetAssign, replaceAssign);
else if (content.includes(targetAssignLF)) content = content.replace(targetAssignLF, replaceAssignLF);

const targetItems = "WHERE c6.c6_num = ANY($1)\r\n                  AND c6.d_e_l_e_t_ = ''";
const replaceItems = "WHERE c6.c6_num = ANY($1)\r\n                  AND c6.d_e_l_e_t_ = ''\r\n                  ${priFilterItems}";
const targetItemsLF = "WHERE c6.c6_num = ANY($1)\n                  AND c6.d_e_l_e_t_ = ''";
const replaceItemsLF = "WHERE c6.c6_num = ANY($1)\n                  AND c6.d_e_l_e_t_ = ''\n                  ${priFilterItems}";

if (content.includes(targetItems)) content = content.replace(targetItems, replaceItems);
else if (content.includes(targetItemsLF)) content = content.replace(targetItemsLF, replaceItemsLF);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully restored all fixes in reports.js!');
