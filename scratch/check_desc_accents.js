const db = require('../server/services/protheusDB');

async function testStructure() {
    try {
        const queryStr = `
            SELECT b1_cod, b1_desc
            FROM public.sb1010
            WHERE b1_desc ~ '[ÁÉÍÓÚÂÊÔÃÕÇ]'
            LIMIT 5;
        `;
        const res = await db.query(queryStr);
        console.log('Postgres raw rows:');
        res.rows.forEach(r => {
            console.log(`Code: ${r.b1_cod} | Desc: ${r.b1_desc}`);
        });

        // Let's test the recursive query for a product
        // Let's find a product code that has a structure
        const query2 = `
            SELECT TRIM(g1_cod) as parent, TRIM(g1_comp) as comp
            FROM public.sg1010
            LIMIT 5;
        `;
        const res2 = await db.query(query2);
        console.log('\nStructure links:');
        res2.rows.forEach(r => {
            console.log(`Parent: ${r.parent} -> Comp: ${r.comp}`);
        });
        
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

testStructure();
