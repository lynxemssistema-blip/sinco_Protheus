const mysql = require('../services/mysqlService');

async function run() {
  const tables = ['app_ata_viva_tarefas', 'app_calendario_atividades', 'app_pcp_delivery_forecasts', 'sistema_avisos'];
  for (const t of tables) {
    const [cols] = await mysql.query(`SHOW COLUMNS FROM \`${t}\``);
    console.log(t, cols.map(c => c.Field));
  }
  process.exit(0);
}
run();
