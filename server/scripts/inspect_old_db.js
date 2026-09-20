const mysql = require('mysql2/promise');

async function inspectOldDb() {
    const srcConfig = {
        host: '193.203.175.68',
        user: 'u494795077_Metalfisa',
        password: '10207597Rdv*',
        database: 'u494795077_Metalfisa',
        dateStrings: true,
        connectTimeout: 20000
    };

    console.log('🔍 Conectando ao MySQL antigo u494795077_Metalfisa...');
    const conn = await mysql.createConnection(srcConfig);

    const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    console.log(`Encontradas ${tables.length} tabelas base no MySQL antigo.\n`);

    let totalRows = 0;
    let tablesWithData = 0;
    const tableList = [];

    for (const row of tables) {
        const tableName = Object.values(row)[0];
        try {
            const [c] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
            const cnt = c[0].cnt;
            if (cnt > 0) {
                tablesWithData++;
                totalRows += cnt;
                tableList.push({ table: tableName, count: cnt });
                console.log(`- ${tableName.padEnd(35)} : ${cnt.toLocaleString('pt-BR')} registros`);
            }
        } catch (err) {
            console.error(`Erro ao contar ${tableName}:`, err.message);
        }
    }

    console.log(`\n📊 Total de tabelas com dados: ${tablesWithData}`);
    console.log(`📊 Total geral de registros a copiar: ${totalRows.toLocaleString('pt-BR')}`);

    await conn.end();
}

inspectOldDb().catch(console.error);
