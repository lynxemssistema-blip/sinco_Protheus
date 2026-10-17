const db = require('./server/services/mysqlService');

async function migrate() {
    try {
        const query1 = `ALTER TABLE usuario ADD COLUMN idFornecedor VARCHAR(15) DEFAULT NULL;`;
        const query2 = `ALTER TABLE usuario ADD COLUMN lojaFornecedor VARCHAR(5) DEFAULT NULL;`;
        
        try {
            await db.query(query1);
            console.log("Column idFornecedor added.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("idFornecedor already exists.");
            else throw e;
        }

        try {
            await db.query(query2);
            console.log("Column lojaFornecedor added.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("lojaFornecedor already exists.");
            else throw e;
        }
        
        console.log("Migration finished.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
}

migrate();
