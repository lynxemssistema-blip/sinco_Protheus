const mysqlPool = require('../server/services/mysqlService');

async function check() {
  try {
    const [columns] = await mysqlPool.query('DESCRIBE app_lotes_corte');
    console.log(columns);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
