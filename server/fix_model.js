require('dotenv').config();
const pool = require('./services/mysqlService');

async function fix() {
    const [r] = await pool.query(
        "UPDATE pcpmetal_agentes SET modelo = 'gemini-2.0-flash-001' WHERE modelo IN ('gemini-1.5-pro','gemini-2.0-flash')"
    );
    console.log('Updated:', r.affectedRows, 'agents to gemini-2.0-flash-001');
    process.exit(0);
}
fix().catch(e => { console.error(e.message); process.exit(1); });
