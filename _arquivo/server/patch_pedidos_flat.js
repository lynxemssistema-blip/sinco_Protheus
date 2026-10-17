// patch_pedidos_flat.js — removes the expensive pcp_type LATERAL join
// Run: node patch_pedidos_flat.js

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'routes', 'pedidos.js');
let src = fs.readFileSync(file, 'utf8');

// ── PATCH 1: Simplify WHERE clause (remove pcp_type references) ───────────────
const oldWhere = `        // MANDATORY BASE FILTER:
        // - not deleted, not budget
        // - active items (qtd_faturar > 0)
        // - revision matches
        // - PCP type (has_structure=true, is_restricted=false) via LATERAL join below
        let whereClause = \`WHERE
            COALESCE(c5.d_e_l_e_t_, '') = ''
            AND c5.c5_tipo <> 'B'
            AND COALESCE(c6.d_e_l_e_t_, '') = ''
            AND (c6.c6_qtdven - c6.c6_qtdent) > 0
            AND COALESCE(c6.c6_xrevm, '') = COALESCE(c6.c6_xrevc, '')
            AND pcp_type.has_structure = true
            AND pcp_type.is_restricted = false\`;`;

const newWhere = `        // MANDATORY BASE FILTER: not deleted, not budget, active items, revision matches
        // PCP type is guaranteed by pcp_delivery_forecast_date+qty filter (post-enrichment)
        let whereClause = \`WHERE
            COALESCE(c5.d_e_l_e_t_, '') = ''
            AND c5.c5_tipo <> 'B'
            AND COALESCE(c6.d_e_l_e_t_, '') = ''
            AND (c6.c6_qtdven - c6.c6_qtdent) > 0
            AND COALESCE(c6.c6_xrevm, '') = COALESCE(c6.c6_xrevc, '')\`;`;

// ── PATCH 2: Remove the pcp_type LATERAL join from query ─────────────────────
const oldLateral = `            JOIN LATERAL (
                SELECT
                    EXISTS (
                        SELECT 1 FROM public.sg1010 s1 WHERE TRIM(s1.g1_cod) = TRIM(c6.c6_produto) AND COALESCE(s1.d_e_l_e_t_,'') <> '*'
                        UNION ALL
                        SELECT 1 FROM public.sg2010 s2 WHERE TRIM(s2.g2_produto) = TRIM(c6.c6_produto) AND COALESCE(s2.d_e_l_e_t_,'') <> '*'
                    ) AS has_structure,
                    EXISTS (
                        SELECT 1 FROM public.sb1010 fsb WHERE TRIM(fsb.b1_cod) = TRIM(c6.c6_produto) AND COALESCE(fsb.d_e_l_e_t_,'') <> '*' AND fsb.b1_msblql IN ('1','S','T','Y')
                        UNION ALL
                        SELECT 1 FROM public.sz0010 fsz WHERE TRIM(fsz.z0_produto) = TRIM(c6.c6_produto) AND COALESCE(fsz.d_e_l_e_t_,'') <> '*' AND fsz.z0_status = 'P'
                    ) AS is_restricted
            ) pcp_type ON true`;

// ── PATCH 3: Remove pcp_type from COUNT query ─────────────────────────────────
const oldCountLateral = `            JOIN LATERAL (
                SELECT
                    EXISTS (
                        SELECT 1 FROM public.sg1010 s1 WHERE TRIM(s1.g1_cod) = TRIM(c6.c6_produto) AND COALESCE(s1.d_e_l_e_t_,'') <> '*'
                        UNION ALL SELECT 1 FROM public.sg2010 s2 WHERE TRIM(s2.g2_produto) = TRIM(c6.c6_produto) AND COALESCE(s2.d_e_l_e_t_,'') <> '*'
                    ) AS has_structure,
                    EXISTS (
                        SELECT 1 FROM public.sb1010 fsb WHERE TRIM(fsb.b1_cod) = TRIM(c6.c6_produto) AND COALESCE(fsb.d_e_l_e_t_,'') <> '*' AND fsb.b1_msblql IN ('1','S','T','Y')
                        UNION ALL SELECT 1 FROM public.sz0010 fsz WHERE TRIM(fsz.z0_produto) = TRIM(c6.c6_produto) AND COALESCE(fsz.d_e_l_e_t_,'') <> '*' AND fsz.z0_status = 'P'
                    ) AS is_restricted
            ) pcp_type ON true`;

let patched = src;
let changes = 0;

if (patched.includes(oldWhere)) {
    patched = patched.replace(oldWhere, newWhere);
    changes++;
    console.log('✅ Patch 1 (WHERE clause) applied');
} else {
    console.log('⚠️  Patch 1 not found (already applied or text mismatch)');
}

if (patched.includes(oldLateral)) {
    patched = patched.replace(oldLateral, '            -- pcp_type filter removed (enforced via forecast date+qty post-enrichment)');
    changes++;
    console.log('✅ Patch 2 (LATERAL join in main query) applied');
} else {
    console.log('⚠️  Patch 2 not found');
}

if (patched.includes(oldCountLateral)) {
    patched = patched.replace(oldCountLateral, '            -- pcp_type removed from count');
    changes++;
    console.log('✅ Patch 3 (LATERAL join in COUNT) applied');
} else {
    console.log('⚠️  Patch 3 not found');
}

if (changes > 0) {
    fs.writeFileSync(file, patched, 'utf8');
    console.log(`\n✅ File patched (${changes} changes). Restart the server.`);
} else {
    console.log('\n❌ No changes applied. Check text matching.');
}
