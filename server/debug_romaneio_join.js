const mysqlPool = require('./services/mysqlService');

async function testJoin(romaneioId) {
    try {
        console.log(`🔍 Testing JOIN for Romaneio ID: ${romaneioId}`);

        const query = `
            SELECT i.*, d.peso_kg, d.area_pintura_m2 
            FROM app_romaneio_items i
            LEFT JOIN produtos_docs d ON d.codigo_produto = i.codigo_produto
            WHERE i.romaneio_id = ?
        `;

        const [rows] = await mysqlPool.execute(query, [romaneioId]);
        console.log(`✅ Success! Found ${rows.length} items.`);
        if (rows.length > 0) {
            console.log('Sample item:', rows[0]);
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ SQL Error:', err.message);
        console.error('Code:', err.code);
        process.exit(1);
    }
}

// Check tables schemas if query fails
async function checkSchemas() {
    try {
        console.log('\n🔍 Checking Schemas...');
        const [colsI] = await mysqlPool.query("DESCRIBE app_romaneio_items");
        console.log('Items columns:', colsI.map(c => c.Field).join(', '));

        const [colsD] = await mysqlPool.query("DESCRIBE produtos_docs");
        console.log('Docs columns:', colsD.map(c => c.Field).join(', '));
    } catch (err) {
        console.error('❌ Schema Check Error:', err.message);
    }
}

// Run test with ID 1 (replace with active ID if known)
// Or just check schemas first
(async () => {
    await checkSchemas();
    // Try to find a valid romaneio ID
    const [r] = await mysqlPool.query("SELECT id FROM app_romaneios LIMIT 1");
    if (r.length > 0) {
        await testJoin(r[0].id);
    } else {
        console.log('No romaneios found to test join.');
        process.exit(0);
    }
})();
