require('dotenv').config();
const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        const [myRes] = await mysqlPool.execute(
            "SELECT id, produto_codigo, titulo, url_arquivo, created_at FROM produtos_docs ORDER BY created_at DESC LIMIT 20"
        );
        console.log('MySQL Recent produtos_docs:', myRes);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
