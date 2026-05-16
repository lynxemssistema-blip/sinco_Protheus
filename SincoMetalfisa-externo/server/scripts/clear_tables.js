const mysqlPool = require('../services/mysqlService');

async function run() {
    try {
        console.log('Truncating tables...');
        
        // Disable foreign key checks to allow truncating parent tables
        await mysqlPool.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // Romaneios
        console.log('Truncating Romaneios...');
        try { await mysqlPool.query('TRUNCATE TABLE app_romaneio_revisoes'); } catch (e) { console.log(e.message) }
        try { await mysqlPool.query('TRUNCATE TABLE app_romaneios_nfs'); } catch (e) { console.log(e.message) }
        try { await mysqlPool.query('TRUNCATE TABLE app_romaneio_items'); } catch (e) { console.log(e.message) }
        try { await mysqlPool.query('TRUNCATE TABLE app_romaneios'); } catch (e) { console.log(e.message) }
        
        // Engenharia (LEN)
        console.log('Truncating Engineering Releases (LEN)...');
        try { await mysqlPool.query('TRUNCATE TABLE app_engineering_releases'); } catch (e) { console.log(e.message) }
        
        // PCP (LPF)
        console.log('Truncating PCP Releases (LPF)...');
        try { await mysqlPool.query('TRUNCATE TABLE app_pcp_releases'); } catch (e) { console.log(e.message) }
        
        await mysqlPool.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Tables truncated successfully.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
