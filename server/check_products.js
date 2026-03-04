
const db = require('./db');

async function checkProducts() {
    try {
        // Count total products
        console.log("1. Counting total products in sb1010...");
        const count1 = await db.query("SELECT count(*) FROM sb1010 WHERE TRIM(COALESCE(d_e_l_e_t_, '')) = ''");
        console.log("   Total: ", count1.rows[0].count);

        // Count products starting with MT
        console.log("\n2. Counting products starting with 'MT'...");
        const count2 = await db.query("SELECT count(*) FROM sb1010 WHERE TRIM(COALESCE(d_e_l_e_t_, '')) = '' AND b1_cod LIKE 'MT%'");
        console.log("   Total: ", count2.rows[0].count);

        // Count products starting with MT followed by digit
        console.log("\n3. Counting products matching 'MT[0-9]' pattern...");
        const count3 = await db.query("SELECT count(*) FROM sb1010 WHERE TRIM(COALESCE(d_e_l_e_t_, '')) = '' AND b1_cod ~ '^MT[0-9]'");
        console.log("   Total: ", count3.rows[0].count);

        // Sample of first 10 products
        console.log("\n4. First 10 product codes:");
        const sample = await db.query("SELECT b1_cod FROM sb1010 WHERE TRIM(COALESCE(d_e_l_e_t_, '')) = '' LIMIT 10");
        sample.rows.forEach((row, i) => {
            console.log(`   ${i + 1}. "${row.b1_cod}"`);
        });

    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkProducts();
