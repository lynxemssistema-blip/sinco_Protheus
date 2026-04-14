const fs = require('fs');

// ====== Fix 1: materials.js - add missing sh1010 h1 JOIN ======
let mat = fs.readFileSync('server/routes/materials.js', 'utf8');

// The sg2010 JOIN exists at line 102-105, we need to add sh1010 after it
const matOld = `            LEFT JOIN sg2010 g2 \r\n                ON TRIM(g2.g2_produto) = TRIM(e.produto_pai)\r\n                AND TRIM(g2.g2_codigo) = TRIM(e.operacao)\r\n                AND COALESCE(g2.d_e_l_e_t_, '') = ''`;

const matNew = `            LEFT JOIN sg2010 g2 \r\n                ON TRIM(g2.g2_produto) = TRIM(e.produto_pai)\r\n                AND TRIM(g2.g2_codigo) = TRIM(e.operacao)\r\n                AND COALESCE(g2.d_e_l_e_t_, '') = ''\r\n\r\n            LEFT JOIN sh1010 h1\r\n                ON h1.h1_codigo = g2.g2_recurso\r\n                AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')`;

if (mat.includes(matOld)) {
    mat = mat.replace(matOld, matNew);
    console.log('OK: materials.js - added sh1010 JOIN');
} else {
    console.log('WARNING: materials.js - pattern not found');
}
fs.writeFileSync('server/routes/materials.js', mat);

// ====== Fix 2: production.js - two issues ======
let prod = fs.readFileSync('server/routes/production.js', 'utf8');

// Fix 2a: Line ~2358 - h1_descri vs h1.h1_descri (bare column in sh1010 direct query)
// The query is SELECT FROM sh1010 directly so we can use just the column name without alias
const prod2aOld = `SELECT \n                h1_codigo  AS cod_recurso,\n    h1.h1_descri  AS desc_recurso\n            FROM public.sh1010`;
const prod2aNew = `SELECT \n                h1_codigo  AS cod_recurso,\n                h1_descri  AS desc_recurso\n            FROM public.sh1010`;

if (prod.includes(prod2aOld)) {
    prod = prod.replace(prod2aOld, prod2aNew);
    console.log('OK: production.js - fixed bare h1_descri in sh1010 direct query (h1. alias removed)');
} else {
    // Try CRLF version
    const prod2aOldCR = prod2aOld.replace(/\n/g, '\r\n');
    if (prod.includes(prod2aOldCR)) {
        prod = prod.replace(prod2aOldCR, prod2aNew.replace(/\n/g, '\r\n'));
        console.log('OK: production.js - fixed bare h1_descri in sh1010 direct query (CRLF)');
    } else {
        // Use regex
        const r2a = /h1_codigo\s+AS cod_recurso,\s*\n\s*h1\.h1_descri\s+AS desc_recurso\s*\n\s*FROM public\.sh1010/;
        if (r2a.test(prod)) {
            prod = prod.replace(r2a, 'h1_codigo  AS cod_recurso,\n                h1_descri  AS desc_recurso\n            FROM public.sh1010');
            console.log('OK: production.js - fixed via regex');
        } else {
            console.log('WARNING: production.js 2a - pattern not found');
        }
    }
}

// Fix 2b: Line ~2513 - OPsRoteiro CTE missing sh1010 JOIN
const prod2bOld = `    TRIM(h1.h1_descri) AS desc_operacao
                FROM OPsCabecalho op
                LEFT JOIN public.sg2010 g2 
                    ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                    AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
)`;

const prod2bNew = `    TRIM(h1.h1_descri) AS desc_operacao
                FROM OPsCabecalho op
                LEFT JOIN public.sg2010 g2 
                    ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                    AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
                LEFT JOIN public.sh1010 h1
                    ON h1.h1_codigo = g2.g2_recurso
                    AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
)`;

if (prod.includes(prod2bOld)) {
    prod = prod.replace(prod2bOld, prod2bNew);
    console.log('OK: production.js - added sh1010 JOIN to OPsRoteiro CTE');
} else {
    const r2b = /TRIM\(h1\.h1_descri\) AS desc_operacao\s+FROM OPsCabecalho op\s+LEFT JOIN public\.sg2010 g2\s+ON btrim\(g2\.g2_produto\) = btrim\(op\.cod_produto\)\s+AND COALESCE\(g2\.d_e_l_e_t_, ''\) IN\('', ' '\)\s*\)/;
    if (r2b.test(prod)) {
        prod = prod.replace(r2b, `TRIM(h1.h1_descri) AS desc_operacao
                FROM OPsCabecalho op
                LEFT JOIN public.sg2010 g2 
                    ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                    AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
                LEFT JOIN public.sh1010 h1
                    ON h1.h1_codigo = g2.g2_recurso
                    AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
)`);
        console.log('OK: production.js - added sh1010 JOIN to OPsRoteiro CTE (regex)');
    } else {
        console.log('WARNING: production.js 2b - OPsRoteiro pattern not found');
    }
}

fs.writeFileSync('server/routes/production.js', prod);
console.log('All fixes applied!');
