const db = require('./services/mysqlService');

async function checkOp() {
    try {
        const [rows] = await db.query(
            "SELECT * FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = '004618' AND TRIM(item) = '17'"
        );
        console.log("Records for Pedido 004618 - Item 17:");
        console.table(rows);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

checkOp();
