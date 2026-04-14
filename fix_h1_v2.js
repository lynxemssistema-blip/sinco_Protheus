const fs = require('fs');

// Fix 1: producao.js - add missing sh1010 JOIN in vertical route
let c = fs.readFileSync('server/routes/producao.js', 'utf8');
const regex1 = /(INNER JOIN public\.sg2010 g2\s+ON btrim\(g2\.g2_produto\) = btrim\(c2\.c2_produto\) AND COALESCE\(g2\.d_e_l_e_t_, ''\) = ''\s+)(LEFT JOIN public\.sc6010)/;
const sh1join = "LEFT JOIN public.sh1010 h1\n        ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')\n      ";

if (regex1.test(c)) {
    c = c.replace(regex1, (m, g2part, next) => g2part + sh1join + next);
    console.log('OK: producao.js - added sh1010 JOIN');
} else {
    console.log('WARNING: producao.js pattern not found');
}
fs.writeFileSync('server/routes/producao.js', c);

// Fix 2: produtos.js - rewrite /roteiro query to use clean JOIN pattern
let p = fs.readFileSync('server/routes/produtos.js', 'utf8');
const roteiroOld = /const query = `\s*WITH descricoes_padrao AS[\s\S]*?ORDER BY sg2\.g2_operac\s*`/;

const roteiroNew = `const query = \`
            SELECT
                g2.g2_operac                    AS operacao,
                TRIM(h1.h1_descri)              AS descricao,
                TRIM(g2.g2_recurso)             AS recurso,
                g2.g2_setup                     AS tempo_setup,
                g2.g2_tempad                    AS tempo_padrao,
                g2.g2_ferram                    AS ferramentas,
                g2.g2_depto                     AS departamento
            FROM public.sg2010 g2
            LEFT JOIN public.sh1010 h1
                ON h1.h1_codigo = g2.g2_recurso
                AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(g2.g2_produto) = $1
            AND (g2.d_e_l_e_t_ = '' OR g2.d_e_l_e_t_ = ' ')
            AND g2.g2_codigo = (
                SELECT MAX(g2_sub.g2_codigo)
                FROM public.sg2010 g2_sub
                WHERE TRIM(g2_sub.g2_produto) = TRIM(g2.g2_produto)
                AND (g2_sub.d_e_l_e_t_ = '' OR g2_sub.d_e_l_e_t_ = ' ')
            )
            ORDER BY g2.g2_operac
        \``;

if (roteiroOld.test(p)) {
    p = p.replace(roteiroOld, roteiroNew);
    console.log('OK: produtos.js - rewrote /roteiro query');
} else {
    console.log('WARNING: produtos.js /roteiro query pattern not found');
}
fs.writeFileSync('server/routes/produtos.js', p);
console.log('Done!');
