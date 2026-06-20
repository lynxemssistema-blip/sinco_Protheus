const fs = require('fs');
const path = require('path');

const filePath = path.join('server', 'routes', 'producao.js');
let code = fs.readFileSync(filePath, 'utf8');

// Replace queries
code = code.replace(/plan_inicio_de, plan_inicio_ate/g, 'plan_inicio');
code = code.replace(/plan_inicio_de \|\| plan_inicio_ate/g, 'plan_inicio');
code = code.replace(/plan_inicio_de/g, 'plan_inicio_ignore'); // Ignore others just in case

// Fix MySQL queries for the first occurrence (vertical-pendencias)
code = code.replace(\if (plan_inicio_ignore) {
        mysqlQuery += \\\ AND data_planejada_inicio >= ?\\\;
        mysqlParams.push(\\\\ 00:00:00\\\);
      }
      if (plan_inicio_ate) {
        mysqlQuery += \\\ AND data_planejada_inicio <= ?\\\;
        mysqlParams.push(\\\\ 23:59:59\\\);
      }\, \if (plan_inicio) {
        mysqlQuery += \\\ AND data_planejada_inicio <= ?\\\;
        mysqlParams.push(\\\\ 23:59:59\\\);
      }\);

// Fix JavaScript array filter for vertical-pendencias
code = code.replace(\if (plan_inicio_ignore) {
      finalList = finalList.filter(r => r.planejamento_inicio && new Date(r.planejamento_inicio) >= new Date(\\\\T00:00:00\\\));
    }
    if (plan_inicio_ate) {
      finalList = finalList.filter(r => r.planejamento_inicio && new Date(r.planejamento_inicio) <= new Date(\\\\T23:59:59\\\));
    }\, \if (plan_inicio) {
      finalList = finalList.filter(r => r.planejamento_inicio && new Date(r.planejamento_inicio) <= new Date(\\\\T23:59:59\\\));
    }\);

// Fix MySQL queries for the second occurrence (vertical/:operacao)
code = code.replace(\if (plan_inicio_ignore) { mysqlQuery += \\\ AND data_planejada_inicio >= ?\\\; mysqlParams.push(\\\\ 00:00:00\\\); }
      if (plan_inicio_ate) { mysqlQuery += \\\ AND data_planejada_inicio <= ?\\\; mysqlParams.push(\\\\ 23:59:59\\\); }\, \if (plan_inicio) { mysqlQuery += \\\ AND data_planejada_inicio <= ?\\\; mysqlParams.push(\\\\ 23:59:59\\\); }\);

// Fix JavaScript array filter for vertical/:operacao
code = code.replace(\if (plan_inicio_ignore) {
      finalList = finalList.filter(r => toYMD(r.planejamento_inicio) && toYMD(r.planejamento_inicio) >= String(plan_inicio_ignore));
    }
    if (plan_inicio_ate) {
      finalList = finalList.filter(r => toYMD(r.planejamento_inicio) && toYMD(r.planejamento_inicio) <= String(plan_inicio_ate));
    }\, \if (plan_inicio) {
      finalList = finalList.filter(r => toYMD(r.planejamento_inicio) && toYMD(r.planejamento_inicio) <= String(plan_inicio));
    }\);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Backend producao.js updated');
