const mysqlPool = require('./server/services/mysqlService');

async function checkDocs() {
    try {
        console.log('🔍 Checking database for MT6-7688...');

        // Check exact match
        const [exact] = await mysqlPool.execute(
            "SELECT * FROM produtos_docs WHERE produto_codigo = 'MT6-7688'"
        );
        console.log('Exact Match:', exact);

        // Check trimmed match
        const [trimmed] = await mysqlPool.execute(
            "SELECT * FROM produtos_docs WHERE TRIM(produto_codigo) = 'MT6-7688'"
        );
        console.log('Trimmed Match:', trimmed);

        // Check like match
        const [like] = await mysqlPool.execute(
            "SELECT * FROM produtos_docs WHERE produto_codigo LIKE '%MT6-7688%'"
        );
        console.log('LIKE Match:', like);

        if (like.length > 0) {
            console.log('--- Detail Inspector ---');
            like.forEach(row => {
                console.log(`Code: '${row.produto_codigo}'`);
                console.log('Chars:', row.produto_codigo.split('').map(c => c.charCodeAt(0)).join(', '));
            });
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkDocs();
