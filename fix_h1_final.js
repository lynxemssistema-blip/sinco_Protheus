const fs = require('fs');

// ===== Fix producao.js - insert sh1010 JOIN after sg2010 JOIN =====
let c = fs.readFileSync('server/routes/producao.js', 'utf8');

// Find the exact pattern with regex (handles CRLF/LF)
const r = /INNER JOIN public\.sg2010 g2\s+ON btrim\(g2\.g2_produto\) = btrim\(c2\.c2_produto\) AND COALESCE\(g2\.d_e_l_e_t_, ''\) = ''\s+(LEFT JOIN public\.sc6010)/s;

if (r.test(c)) {
    const sh1join = `INNER JOIN public.sg2010 g2
        ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') = ''
      LEFT JOIN public.sh1010 h1
        ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
      $1`;
    c = c.replace(r, (m, nextJoin) => 
        `INNER JOIN public.sg2010 g2\n        ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') = ''\n      LEFT JOIN public.sh1010 h1\n        ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')\n      ` + nextJoin
    );
    console.log('OK: producao.js - sh1010 JOIN added');
} else {
    console.log('WARNING: producao.js - pattern not found, trying line-based edit...');
    // Line-based fallback: find the line with the sg2010 JOIN condition and insert after
    const lines = c.split('\n');
    let inserted = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') = ''") 
            && lines[i+1] && lines[i+1].includes('sc6010')) {
            lines.splice(i + 1, 0, 
                "      LEFT JOIN public.sh1010 h1",
                "        ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')"
            );
            inserted = true;
            console.log('OK: producao.js - sh1010 JOIN inserted via line splice at line', i+1);
            break;
        }
    }
    if (!inserted) console.log('ERROR: producao.js - could not find insertion point');
    c = lines.join('\n');
}

fs.writeFileSync('server/routes/producao.js', c);

// ===== Verify production.js line 2356 =====
// This query selects FROM sh1010 directly - bare h1_descri is CORRECT (no alias needed)
// The audit flagged it but it's valid SQL - no fix needed

console.log('INFO: production.js line 2356 - query selects FROM sh1010 directly, bare h1_descri is correct SQL');

// ===== production_tracking_comparison.js =====
// This file uses SQL SERVER syntax (dbo., RTRIM, protheusPool) - completely different DB
// Cannot add PostgreSQL-style JOIN. This endpoint queries a different MSSQL Protheus instance.
console.log('INFO: production_tracking_comparison.js uses SQL Server (MSSQL) syntax - not PostgreSQL, no fix needed');

console.log('\nDone! Running syntax check...');
