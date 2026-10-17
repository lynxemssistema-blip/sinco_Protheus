const pool = require('./server/services/mysqlService');
pool.query("DESCRIBE app_ata_viva_tarefas")
  .then(([rows]) => console.log(rows))
  .catch(console.error)
  .finally(() => process.exit(0));
