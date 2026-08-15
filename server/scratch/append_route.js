const fs = require('fs');

const cleanRouteLines = fs.readFileSync('c:/Users/lynx/Documents/MetalFisa Anty/server/scratch/clean_route.js', 'utf8').split('\n');

const routeStart = cleanRouteLines.findIndex(l => l.includes('// ── ROTA: Estrutura de Produto por Pedido/OP (BOM Tree + Apontamentos)'));
const routeEnd = cleanRouteLines.findIndex(l => l.includes('module.exports = router;'));
let routeCode = cleanRouteLines.slice(routeStart, routeEnd).join('\n');

// Fix C2_PEDIDO query bug that was missing from git but existed in memory
const oldQuery = "if (pedido)  { pgParams.push(pedido.trim().padStart(6,'0'));   pgWhere.push(`TRIM(c2.c2_pedido) = $${pgParams.length}`); }";
const newQuery = "if (pedido)  { pgParams.push(pedido.trim().padStart(6,'0'));   pgWhere.push(`(TRIM(c2.c2_pedido) = $${pgParams.length} OR TRIM(c2.c2_num) = $${pgParams.length})`); }";
routeCode = routeCode.replace(oldQuery, newQuery);

const pcpFile = 'c:/Users/lynx/Documents/MetalFisa Anty/server/routes/pcpRefinado.js';
const pcpData = fs.readFileSync(pcpFile, 'utf8');

const spliceIndex = pcpData.lastIndexOf('module.exports = router;');
const newFile = pcpData.slice(0, spliceIndex) + '\n\n' + routeCode + '\n\nmodule.exports = router;\n';

fs.writeFileSync(pcpFile, newFile);
console.log('Successfully appended route to pcpRefinado.js!');
