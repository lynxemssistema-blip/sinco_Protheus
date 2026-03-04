const db = require('./db');

async function verify() {
    try {
        console.log('--- VERIFYING DATA ---');

        const pcNum = '002710';
        const produto = 'MPT-1437';
        const nfNum = '000038429';

        console.log(`Searching for PC: ${pcNum}, Prod: ${produto}, NF: ${nfNum}`);

        // 1. Check PC (SC7)
        const pcQuery = `
            SELECT c7_num, c7_item, c7_produto, c7_quant, c7_preco, c7_total, c7_emissao
            FROM sc7010
            WHERE c7_num LIKE $1 AND c7_produto ILIKE $2
        `;
        const pcRes = await db.query(pcQuery, [`%${pcNum}%`, `%${produto}%`]);
        console.log('\n[PURCHASE ORDER (PC)]');
        if (pcRes.rows.length === 0) console.log('No PC found matching criteria.');
        pcRes.rows.forEach(r => console.log(r));

        // 2. Check Invoice Items (SD1) linked to this PC
        const nfQuery = `
            SELECT d1_doc, d1_serie, d1_fornece, d1_loja, d1_item, d1_cod, d1_quant, d1_vunit, d1_total, d1_pedido, d1_itempc
            FROM sd1010
            WHERE d1_pedido LIKE $1 AND d1_cod ILIKE $2
        `;
        const nfRes = await db.query(nfQuery, [`%${pcNum}%`, `%${produto}%`]);
        console.log('\n[INVOICE ITEMS (SD1) LINKED TO PC]');
        if (nfRes.rows.length === 0) console.log('No linked invoice items found.');
        nfRes.rows.forEach(r => console.log(r));

        // 3. Check Specific Invoice Header (SF1) if mentioned
        const sf1Query = `
            SELECT f1_doc, f1_serie, f1_fornece, f1_loja, f1_emissao, f1_recbmto
            FROM sf1010
            WHERE f1_doc LIKE $1
        `;
        const sf1Res = await db.query(sf1Query, [`%${nfNum}%`]);
        console.log('\n[INVOICE HEADER (SF1) FOR NF ' + nfNum + ']');
        if (sf1Res.rows.length === 0) console.log('No invoice header found.');
        sf1Res.rows.forEach(r => console.log(r));

    } catch (e) {
        console.error(e);
    }
}

verify();
