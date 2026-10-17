const fs = require('fs');
let content = fs.readFileSync('server/routes/producao.js', 'utf8');

// Fix 1: getVerticalPendencies
let match1 = `      if (plannedOps.length === 0) {
        return res.json([]); // No OPs planned in this date range at all
      }
      opFilterFromMySQL = plannedOps.map(o => String(o.op_numero).trim());
    }

    if (opFilterFromMySQL) {
      if (opFilterFromMySQL.length > 5000) {
        opFilterFromMySQL = opFilterFromMySQL.slice(0, 5000);
      }
      const inPlaceholders = opFilterFromMySQL.map((_, i) => \`$\${pCount + i}\`).join(',');
      conditions.push(\`TRIM(c2.c2_num) IN (\${inPlaceholders})\`);
      paramsArr.push(...opFilterFromMySQL);
      pCount += opFilterFromMySQL.length;
    }`;

let repl1 = `      if (plannedOps.length === 0) {
        return res.json([]); // No OPs planned in this date range at all
      }
      opFilterFromMySQL = plannedOps.map(o => String(o.op_numero).trim());
    }

    if (opFilterFromMySQL) {
      conditions.push(\`TRIM(c2.c2_num) = ANY(\$\${pCount})\`);
      paramsArr.push(opFilterFromMySQL);
      pCount++;
    }`;

content = content.replace(match1, repl1);

// Fix 2: /vertical/:operacao
let match2 = `      const [plannedOps] = await mysqlPool.query(mysqlQuery, mysqlParams);
      if (plannedOps.length === 0) return res.json([]);
      opFilterFromMySQL = plannedOps.map(o => String(o.op_numero).trim()).slice(0, 5000);
    }`;

let repl2 = `      const [plannedOps] = await mysqlPool.query(mysqlQuery, mysqlParams);
      if (plannedOps.length === 0) return res.json([]);
      opFilterFromMySQL = plannedOps.map(o => String(o.op_numero).trim());
    }`;

content = content.replace(match2, repl2);

// Fix 3: /vertical/:operacao LIMIT 500
let match3 = `      \${sc2Where}
      ORDER BY c6.c6_entreg ASC NULLS LAST, c2.c2_pedido ASC, c2.c2_num ASC
      LIMIT 500
    \`;`;

let repl3 = `      \${sc2Where}
      ORDER BY c6.c6_entreg ASC NULLS LAST, c2.c2_pedido ASC, c2.c2_num ASC
      \${opFilterFromMySQL && opFilterFromMySQL.length > 0 ? '' : 'LIMIT 500'}
    \`;`;

content = content.replace(match3, repl3);

fs.writeFileSync('server/routes/producao.js', content);
console.log('producao.js updated successfully.');
