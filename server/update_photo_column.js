const mysql = require('mysql2/promise');
require('dotenv').config();

async function updatePhotoColumn() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        console.log('--- UPDATING PHOTO COLUMN ---');

        // Check current type (optional but good for log)
        const [columns] = await connection.execute("SHOW COLUMNS FROM usuario LIKE 'fotoUsuario'");
        if (columns.length > 0) {
            console.log('Current Type:', columns[0].Type);
        }

        // Modify to LONGTEXT
        console.log('Changing fotoUsuario to LONGTEXT...');
        await connection.execute('ALTER TABLE usuario MODIFY COLUMN fotoUsuario LONGTEXT');
        console.log('✅ Column fotoUsuario modified to LONGTEXT.');

        // Verify
        const [verify] = await connection.execute("SHOW COLUMNS FROM usuario LIKE 'fotoUsuario'");
        console.log('New Type:', verify[0].Type);

    } catch (error) {
        console.error('❌ Error modifying table:', error);
    } finally {
        await connection.end();
        console.log('--- FINISHED ---');
    }
}

updatePhotoColumn();
