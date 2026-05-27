const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const db = require('../server/services/mysqlService');

function cleanData(val) {
    if (!val) return null;
    let parsed = null;
    
    // Attempt 1: Parse the direct value
    try {
        parsed = JSON.parse(val);
    } catch (e) {
        console.log(`Direct parse failed: ${e.message}`);
        return val; // leave as is if not json
    }

    // Check if it's the spread string character map (e.g. {"0": "{", "1": "\"", ...})
    if (parsed && typeof parsed === 'object' && parsed['0'] !== undefined) {
        console.log('Detected character array serialization. Reconstructing...');
        try {
            // Sort keys numerically and join values
            const keys = Object.keys(parsed).filter(k => !isNaN(k)).sort((a, b) => parseInt(a) - parseInt(b));
            const reconstructedStr = keys.map(k => parsed[k]).join('');
            console.log('Reconstructed string:', reconstructedStr);
            // Parse the reconstructed string
            let innerParsed = JSON.parse(reconstructedStr);
            if (typeof innerParsed === 'string') {
                innerParsed = JSON.parse(innerParsed);
            }
            return JSON.stringify(innerParsed);
        } catch (e) {
            console.error('Failed to reconstruct from char array:', e);
        }
    }

    // Keep parsing if it is nested strings
    let depth = 0;
    while (typeof parsed === 'string' && depth < 5) {
        try {
            parsed = JSON.parse(parsed);
            depth++;
        } catch (e) {
            break;
        }
    }

    if (parsed && typeof parsed === 'object') {
        return JSON.stringify(parsed);
    }
    return val;
}

async function run() {
    try {
        const [rows] = await db.query('SELECT id, f097_dados FROM app_sgq_rncs');
        console.log(`Found ${rows.length} records. Auditing...`);

        for (const row of rows) {
            const cleaned = cleanData(row.f097_dados);
            if (cleaned !== row.f097_dados) {
                console.log(`Cleaning RNC ID ${row.id}...`);
                await db.query('UPDATE app_sgq_rncs SET f097_dados = ? WHERE id = ?', [cleaned, row.id]);
                console.log(`RNC ID ${row.id} updated.`);
            }
        }
        console.log('Audit and cleanup completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Error running cleanup:', e);
        process.exit(1);
    }
}

run();
