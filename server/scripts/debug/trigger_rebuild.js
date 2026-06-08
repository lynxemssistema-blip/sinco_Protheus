const { rebuildDailyOccupancyCache } = require('../../services/occupancyCacheService');

async function main() {
    try {
        console.log('Triggering daily occupancy cache rebuild...');
        await rebuildDailyOccupancyCache();
        console.log('✅ Rebuild function finished.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Rebuild failed:', err);
        process.exit(1);
    }
}

main();
