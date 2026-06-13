const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkIndexes() {
    try {
        const [indexes] = await mysqlPool.query('SHOW INDEX FROM app_production_planning');
        console.log('--- Indexes on app_production_planning ---');
        console.log(indexes.map(idx => ({
            Table: idx.Table,
            Non_unique: idx.Non_unique,
            Key_name: idx.Key_name,
            Seq_in_index: idx.Seq_in_index,
            Column_name: idx.Column_name,
            Collation: idx.Collation,
            Cardinality: idx.Cardinality
        })));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
checkIndexes();
