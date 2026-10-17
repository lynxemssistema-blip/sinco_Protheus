const mysql = require('./services/mysqlService');

async function check() {
    try {
        const [rows] = await mysql.execute("SELECT * FROM produtos_docs WHERE produto_codigo LIKE '%MPT%' LIMIT 5");
        console.log('Results for MPT:', rows.map(r => r.produto_codigo));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

check();
