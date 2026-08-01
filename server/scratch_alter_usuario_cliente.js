const db = require('./services/mysqlService');

async function alterTable() {
    try {
        await db.query(`ALTER TABLE usuario ADD COLUMN idCliente VARCHAR(15) DEFAULT NULL;`);
        console.log("Column idCliente added.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log("idCliente already exists.");
        else console.error(e);
    }
    
    try {
        await db.query(`ALTER TABLE usuario ADD COLUMN lojaCliente VARCHAR(5) DEFAULT NULL;`);
        console.log("Column lojaCliente added.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log("lojaCliente already exists.");
        else console.error(e);
    }
    
    try {
        await db.query(`ALTER TABLE usuario ADD COLUMN tipoExterno VARCHAR(20) DEFAULT 'fornecedor';`);
        console.log("Column tipoExterno added.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log("tipoExterno already exists.");
        else console.error(e);
    }

    process.exit(0);
}

alterTable();
