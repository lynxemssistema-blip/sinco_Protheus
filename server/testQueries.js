require('dotenv').config();
const db = require('./db.js');

async function run() {
  try {
    const sc2Res = await db.query(`
      SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as seq, TRIM(c2_produto) as prod, c2_quant
      FROM sc2010 
      WHERE c2_num LIKE '%003755%' AND c2_item = '03' AND c2_sequen = '037'
    `);
    console.log('--- Protheus SC2010 OP 003755 ITEM 03 SEQ 037 ---');
    console.table(sc2Res.rows);

    const sc2Res2 = await db.query(`
      SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as seq, TRIM(c2_produto) as prod, c2_quant
      FROM sc2010 
      WHERE c2_num LIKE '%003755%' AND c2_produto LIKE '%24972%'
    `);
    console.log('\n--- Protheus SC2010 OP 003755 PRODUTO MT5-24972 ---');
    console.table(sc2Res2.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
