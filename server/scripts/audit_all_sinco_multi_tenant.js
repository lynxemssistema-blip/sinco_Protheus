const mysql = require('mysql2/promise');

async function auditMultiTenantTables() {
    const conn = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_sinco',
        password: 'Sinco2026!*',
        database: 'u494795077_SINCO'
    });

    try {
        // Obter todas as tabelas BASE
        const [tables] = await conn.query(`
            SELECT TABLE_NAME 
            FROM information_schema.tables 
            WHERE TABLE_SCHEMA = 'u494795077_SINCO' 
              AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);

        // Obter todas as colunas que representam IdEmpresa
        const [empColumns] = await conn.query(`
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT 
            FROM information_schema.columns 
            WHERE TABLE_SCHEMA = 'u494795077_SINCO' 
              AND LOWER(COLUMN_NAME) IN ('idempresa', 'id_empresa', 'empresa_id')
        `);

        const tablesWithEmp = new Map();
        for (const c of empColumns) {
            tablesWithEmp.set(c.TABLE_NAME, c);
        }

        const withEmp = [];
        const withoutEmp = [];

        for (const t of tables) {
            const tblName = t.TABLE_NAME;
            if (tablesWithEmp.has(tblName)) {
                withEmp.push({
                    table: tblName,
                    column: tablesWithEmp.get(tblName).COLUMN_NAME,
                    default: tablesWithEmp.get(tblName).COLUMN_DEFAULT
                });
            } else {
                withoutEmp.push(tblName);
            }
        }

        console.log(`=== AUDITORIA GERAL MULTI-EMPRESA (SINCO) ===`);
        console.log(`Total de tabelas base: ${tables.length}`);
        console.log(`Tabelas COM IdEmpresa: ${withEmp.length} (${((withEmp.length / tables.length) * 100).toFixed(1)}%)`);
        console.log(`Tabelas SEM IdEmpresa: ${withoutEmp.length} (${((withoutEmp.length / tables.length) * 100).toFixed(1)}%)\n`);

        console.log(`Tabelas SEM IdEmpresa:`);
        console.log(JSON.stringify(withoutEmp, null, 2));

    } finally {
        await conn.end();
    }
}

auditMultiTenantTables().catch(console.error);
