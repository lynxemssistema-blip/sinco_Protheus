const db = require('./db');

(async () => {
    try {
        console.log('--- 🔍 VERIFICAÇÃO FINAL DA CORREÇÃO ---');

        // 1. Count with INNER JOIN (Old Logic)
        const qOld = `
            SELECT COUNT(*) as total
            FROM public.sc2010 c2
            JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            WHERE c2.d_e_l_e_t_ = ' '
        `;
        const resOld = await db.query(qOld);
        console.log(`1. Total de registros (INNER JOIN - Antigo): ${resOld.rows[0].total}`);

        // 2. Count with LEFT JOIN (New Logic)
        const qNew = `
            SELECT COUNT(*) as total
            FROM public.sc2010 c2
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            WHERE c2.d_e_l_e_t_ = ' '
        `;
        const resNew = await db.query(qNew);
        console.log(`2. Total de registros (LEFT JOIN - Novo):   ${resNew.rows[0].total}`);

        const diff = parseInt(resNew.rows[0].total) - parseInt(resOld.rows[0].total);
        console.log(`\n✅ Diferença (Registros recuperados): ${diff}`);

        if (diff > 0) {
            console.log('   O sistema agora exibe OPs que antes estavam ocultas por falta de roteiro.');
        } else {
            console.log('   ⚠️ Nenhuma diferença encontrada (talvez todas as OPs já tivessem roteiro hoje, ou o problema persiste).');
        }

    } catch (err) {
        console.error('❌ ERRO:', err);
    } finally {
        process.exit();
    }
})();
