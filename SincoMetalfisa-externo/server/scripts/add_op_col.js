const pool = require('../services/mysqlService');

async function fix() {
  try {
    await pool.query('ALTER TABLE app_pcp_delivery_forecasts ADD COLUMN op_protheus VARCHAR(20) DEFAULT NULL');
    console.log("Column added");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists");
    } else {
      console.error("SQL Error:", e.message);
    }
  } finally {
    pool.end();
  }
}
fix();
