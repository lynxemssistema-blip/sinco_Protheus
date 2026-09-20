const pg = require('../db');
async function test() {
    try {
        const q1 = await pg.query("SELECT * FROM sg1010 LIMIT 1");
        console.log('sg1010 keys:', Object.keys(q1.rows[0]));

        const q2 = await pg.query("SELECT * FROM sg2010 LIMIT 1");
        console.log('sg2010 keys:', Object.keys(q2.rows[0]));

        const q3 = await pg.query("SELECT * FROM sc5010 LIMIT 1");
        console.log('sc5010 keys:', Object.keys(q3.rows[0]));

        const q4 = await pg.query("SELECT * FROM sc6010 LIMIT 1");
        console.log('sc6010 keys:', Object.keys(q4.rows[0]));

        const q5 = await pg.query("SELECT * FROM sc2010 LIMIT 1");
        console.log('sc2010 keys:', Object.keys(q5.rows[0]));

        const q6 = await pg.query("SELECT * FROM sb2010 LIMIT 1");
        console.log('sb2010 keys:', Object.keys(q6.rows[0]));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
