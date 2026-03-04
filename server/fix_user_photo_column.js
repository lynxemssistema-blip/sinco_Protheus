const pool = require('./services/mysqlService');

async function fixUserPhotoColumn() {
    try {
        console.log('🔄 Altering table usuario...');
        // Modify column to LONGTEXT to support large Base64 strings
        await pool.query("ALTER TABLE usuario MODIFY COLUMN fotoUsuario LONGTEXT");

        console.log('✅ Column fotoUsuario changed to LONGTEXT successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixUserPhotoColumn();
