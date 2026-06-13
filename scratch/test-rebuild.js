const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { rebuildDailyOccupancyCache } = require('../server/services/occupancyCacheService');

async function testRebuild() {
    await rebuildDailyOccupancyCache();
    process.exit(0);
}
testRebuild();
