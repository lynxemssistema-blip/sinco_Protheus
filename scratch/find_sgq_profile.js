const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function findSgqProfile() {
    try {
        console.log('--- Finding SGQ Access Profile ---');
        
        const [rows] = await mysqlPool.query('SELECT general_config FROM app_company_settings LIMIT 1');
        if (rows.length === 0) {
            console.log('No records found in app_company_settings');
            return;
        }
        
        let gc = rows[0].general_config;
        if (typeof gc === 'string') {
            gc = JSON.parse(gc);
        }
        
        console.log('All custom profiles:');
        if (gc && gc.custom_profiles) {
            console.log(JSON.stringify(gc.custom_profiles, null, 2));
            
            const sgq = gc.custom_profiles.find(p => String(p.code).toUpperCase() === 'SGQ' || String(p.name).toUpperCase().includes('SGQ'));
            if (sgq) {
                console.log('\nFOUND SGQ PROFILE:');
                console.log(JSON.stringify(sgq, null, 2));
            } else {
                console.log('\nNo profile matching SGQ code or name was found in custom_profiles.');
            }
        } else {
            console.log('No custom_profiles defined in general_config:', gc);
        }
        
    } catch (err) {
        console.error('Error finding profile:', err);
    } finally {
        process.exit(0);
    }
}

findSgqProfile();
