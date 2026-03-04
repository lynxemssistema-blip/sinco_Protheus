require('dotenv').config();
const db = require('./db');

async function debugResource() {
    try {
        console.log("Querying SH1010 for ST0055...");
        const res = await db.query(`
            SELECT h1_codigo, h1_descri 
            FROM public.sh1010 
            WHERE h1_codigo = 'ST0055'
        `);

        console.log("Result for ST0055:");
        console.log(res.rows);

        console.log("--------------------------------");
        console.log("Querying SH1010 for ST0057...");
        const res2 = await db.query(`
            SELECT h1_codigo, h1_descri 
            FROM public.sh1010 
            WHERE h1_codigo = 'ST0057'
        `);
        console.log("Result for ST0057:");
        console.log(res2.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

debugResource();
