const mysql = require('./services/mysqlService');

async function search() {
  try {
    const [tables] = await mysql.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    
    console.log('Total tables:', tableNames.length);

    const tablesWithEmpresa5 = [];
    const tablesWithAnyData = [];
    const tablesWithEmpresaCol = {};

    for (const table of tableNames) {
      try {
        const [cols] = await mysql.query(`SHOW COLUMNS FROM \`${table}\``);
        const colNames = cols.map(c => c.Field);
        
        const [countAll] = await mysql.query(`SELECT COUNT(*) as c FROM \`${table}\``);
        const total = countAll[0].c;
        if (total > 0) {
          tablesWithAnyData.push({ table, count: total });
        }

        const empCols = colNames.filter(c => /empresa/i.test(c));
        if (empCols.length > 0) {
          for (const empCol of empCols) {
            const [distinctVals] = await mysql.query(`SELECT DISTINCT \`${empCol}\` as val, COUNT(*) as c FROM \`${table}\` GROUP BY \`${empCol}\``);
            if (distinctVals.length > 0) {
              tablesWithEmpresaCol[table] = distinctVals;
              const has5 = distinctVals.find(d => String(d.val) === '5');
              if (has5) {
                tablesWithEmpresa5.push({ table, col: empCol, count: has5.c });
              }
            }
          }
        }
      } catch(err) {
        // ignore
      }
    }

    console.log('--- TABLES WITH IDEMPRESA = 5 (' + tablesWithEmpresa5.length + ') ---');
    console.log(JSON.stringify(tablesWithEmpresa5, null, 2));

    console.log('--- ALL TABLES WITH DATA (Total with data: ' + tablesWithAnyData.length + ') ---');
    console.log(JSON.stringify(tablesWithAnyData.sort((a,b) => b.count - a.count), null, 2));

    // Also search for "industrial" in string columns or specific tables
    console.log('--- EMPRESA COLUMNS DISTRIBUTION (SAMPLE) ---');
    console.log(JSON.stringify(tablesWithEmpresaCol, null, 2));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

search();
