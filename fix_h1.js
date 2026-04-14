const fs = require('fs');

let c = fs.readFileSync('server/routes/production.js', 'utf8');

// Fix production.js line ~1377: broken sg2010 JOIN (sh1010 was inserted in the middle)
const regex = /LEFT JOIN public\.sg2010 g2 ON\s+LEFT JOIN public\.sh1010 h1 ON h1\.h1_codigo = g2\.g2_recurso AND COALESCE\(h1\.d_e_l_e_t_, ''\) IN \('', ' '\)\s+btrim\(g2\.g2_produto\) = btrim\(c2\.c2_produto\)\s+AND btrim\(g2\.g2_filial\) = btrim\(c2\.c2_filial\)\s+AND COALESCE\(g2\.d_e_l_e_t_, ''\) IN \('', ' '\)\s+LEFT JOIN public\.sh1010 h1 ON\s+h1\.h1_codigo = g2\.g2_recurso\s+AND COALESCE\(h1\.d_e_l_e_t_, ''\) IN \('', ' '\)/;

const replacement = `LEFT JOIN public.sg2010 g2 ON
                btrim(g2.g2_produto) = btrim(c2.c2_produto)
                AND btrim(g2.g2_filial) = btrim(c2.c2_filial)
                AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sh1010 h1 ON
                h1.h1_codigo = g2.g2_recurso
                AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')`;

if (regex.test(c)) {
    c = c.replace(regex, replacement);
    console.log('OK: Fixed broken sg2010 JOIN in production.js');
} else {
    console.log('WARNING: Pattern not found in production.js - manual fix may be needed');
}

// Fix bare h1_descri (no table alias) at line ~2360 in production.js  
c = c.replace(/\n    h1_descri  AS desc_recurso/, '\n    h1.h1_descri  AS desc_recurso');

fs.writeFileSync('server/routes/production.js', c);

// Fix produtos.js - bare h1_descri in subquery (no h1 alias)
let p = fs.readFileSync('server/routes/produtos.js', 'utf8');
// In produtos.js, the subquery uses sg2010 directly without alias and has bare h1_descri
// Replace bare h1_descri references in the subquery that uses sg2010 - revert to g2_descri since no join
p = p.replace(/SELECT g2_recurso, h1_descri/, 'SELECT g2_recurso, g2_descri AS h1_descri');
p = p.replace(/\n                        h1_descri,\n/, '\n                        g2_descri AS h1_descri,\n');
p = p.replace(/ORDER BY COUNT\(\*\) DESC, h1_descri/, 'ORDER BY COUNT(*) DESC, g2_descri');
p = p.replace(/GROUP BY g2_recurso, h1_descri/, 'GROUP BY g2_recurso, g2_descri');
fs.writeFileSync('server/routes/produtos.js', p);
console.log('OK: Fixed produtos.js bare h1_descri subquery');

// Fix vmi.js - double h1.h1_descri COALESCE (was originally h1_descri, g2_descri)
let v = fs.readFileSync('server/routes/vmi.js', 'utf8');
// Check if sh1010 h1 join exists in context - the vmi route already joined sh1010 as h1 per our script
// The original was: ELSE COALESCE(TRIM(h1.h1_descri), TRIM(g2.g2_descri))
// After refactor it became: ELSE COALESCE(TRIM(h1.h1_descri), TRIM(h1.h1_descri))
// Fix to just: ELSE TRIM(h1.h1_descri)
v = v.replace(/ELSE COALESCE\(TRIM\(h1\.h1_descri\), TRIM\(h1\.h1_descri\)\)/g, 'ELSE TRIM(h1.h1_descri)');
fs.writeFileSync('server/routes/vmi.js', v);
console.log('OK: Fixed vmi.js redundant COALESCE');

// Fix pedidos.js - double h1.h1_descri COALESCE
let ped = fs.readFileSync('server/routes/pedidos.js', 'utf8');
ped = ped.replace(/ELSE COALESCE\(TRIM\(h1\.h1_descri\), TRIM\(h1\.h1_descri\)\)/g, 'ELSE TRIM(h1.h1_descri)');
fs.writeFileSync('server/routes/pedidos.js', ped);
console.log('OK: Fixed pedidos.js redundant COALESCE');

console.log('All fixes applied!');
