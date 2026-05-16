const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Executing User SQL...');
        const userQuery = `
            SELECT 
                h1_codigo  AS cod_recurso,
                h1_descri  AS desc_recurso
            FROM public.sh1010
            WHERE d_e_l_e_t_ = ' '
            ORDER BY h1_codigo
        `;
        const res = await db.query(userQuery);
        console.log(`Total rows returned: ${res.rows.length}`);

        const moMatches = res.rows.filter(r => r.cod_recurso.trim().startsWith('MO'));
        console.log(`Rows starting with MO: ${moMatches.length}`);

        const specific = res.rows.find(r => r.cod_recurso.trim() === 'MO0002');
        console.log('Found MO0002?', specific ? 'YES' : 'NO');
        if (specific) console.log(specific);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
