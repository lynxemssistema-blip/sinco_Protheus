
const db = require('./db');
require('dotenv').config();

async function testConnection() {
    console.log('Testing Postgres Connection...');
    try {
        const res = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sc7010' 
            AND column_name LIKE 'c7_u%'
            ORDER BY column_name
        `);
        console.log('✅ Connection Successful!');
        console.log('User Columns in SC7010:', res.rows.map(r => r.column_name));
    } catch (err) {
        console.error('❌ Connection Failed:', err);
    }
}

testConnection();
