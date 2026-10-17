const mysql = require('../services/mysqlService');

async function run() {
  try {
    const [fks] = await mysql.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('salas_reuniao', 'reservas_salas', 'reservas_participantes', 'reservas_historico')
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log('Foreign Keys:', fks);

    const [tables] = await mysql.query(`
      SELECT TABLE_NAME, CREATE_TIME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('salas_reuniao', 'reservas_salas', 'reservas_participantes', 'reservas_historico')
    `);
    console.log('Tables found:', tables);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
