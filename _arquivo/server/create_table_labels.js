require('dotenv').config();
const db = require('./db');

async function createTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS label_config (
                id             SERIAL PRIMARY KEY,
                printer_mode   VARCHAR(10)  DEFAULT 'tcp',
                printer_host   VARCHAR(100) DEFAULT '127.0.0.1',
                printer_port   INTEGER      DEFAULT 9100,
                logo_base64    TEXT,
                logo_width     INTEGER,
                logo_height    INTEGER,
                logo_bytes_row INTEGER,
                logo_bitmap    TEXT,
                label_fields   JSONB        DEFAULT '[]',
                updated_at     TIMESTAMPTZ  DEFAULT NOW()
            )
        `);
        console.log('Table created successfully');
    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        process.exit(0);
    }
}

createTable();
