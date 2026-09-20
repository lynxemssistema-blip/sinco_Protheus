require('dotenv').config({ path: 'server/.env' });
const mysql = require('../server/services/mysqlService');

async function test() {
  const [progs] = await mysql.query(
    "SELECT id, pedido, item, quantidade_pcp, op_protheus, numero_lote, lote, created_at FROM app_pcp_delivery_forecasts WHERE pedido = '005411' AND (item = '01' OR item LIKE '01%') ORDER BY id ASC"
  );
  console.log('005411 item 01 forecasts:', progs);
  process.exit(0);
}
test();
