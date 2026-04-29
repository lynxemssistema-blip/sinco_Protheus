const mysql = require('../server/services/mysqlService');

async function run() {
    const conn = await mysql.getConnection();
    try {
        const cols = ['email VARCHAR(255) NULL', 'aprovado TINYINT DEFAULT 1', 'whatsapp VARCHAR(20) NULL'];
        for (const col of cols) {
            const colName = col.split(' ')[0];
            const [rows] = await conn.query(`SHOW COLUMNS FROM usuario LIKE ?`, [colName]);
            if (rows.length === 0) {
                await conn.query(`ALTER TABLE usuario ADD COLUMN ${col}`);
                console.log(`Adicionada coluna: ${colName}`);
            } else {
                console.log(`Coluna já existe: ${colName}`);
            }
        }
        console.log('OK');
    } finally {
        conn.release();
        process.exit(0);
    }
}
run().catch(e => { console.error(e.message); process.exit(1); });
