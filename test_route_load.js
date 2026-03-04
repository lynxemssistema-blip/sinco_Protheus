const path = require('path');
try {
    const route = require('./server/routes/pcpMaterials');
    console.log('✅ Success: pcpMaterials route loaded correctly');
} catch (err) {
    console.error('❌ Error loading pcpMaterials route:');
    console.error(err);
    process.exit(1);
}
