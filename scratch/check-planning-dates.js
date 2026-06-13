const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkDates() {
    try {
        const [minMax] = await mysqlPool.query(`
            SELECT MIN(data_planejada_inicio) AS min_ini, MAX(data_planejada_inicio) AS max_ini,
                   MIN(data_planejada_fim) AS min_fim, MAX(data_planejada_fim) AS max_fim
            FROM app_production_planning
        `);
        console.log('Date ranges in app_production_planning:', minMax[0]);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
checkDates();
