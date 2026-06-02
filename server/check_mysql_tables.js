const mysqlPool = require('./services/mysqlService');

async function test() {
    try {
        const [rows] = await mysqlPool.query("SHOW TABLES LIKE '%op%'");
        console.log('Tables matching op:', rows);
        
        const [rows2] = await mysqlPool.query("SHOW TABLES LIKE '%pcp%'");
        console.log('Tables matching pcp:', rows2);

        const [rows3] = await mysqlPool.query("SHOW TABLES LIKE '%data%'");
        console.log('Tables matching data:', rows3);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
