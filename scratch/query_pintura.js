const db = require('../server/services/protheusDB');

async function findProducts() {
    try {
        const query = `
            SELECT DISTINCT TRIM(g2_produto) as produto
            FROM public.sg2010
            WHERE TRIM(g2_recurso) = 'MO0024'
            LIMIT 5;
        `;
        const res = await db.query(query);
        console.log('Products using MO0024:');
        res.rows.forEach(r => console.log(r.produto));
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

findProducts();
