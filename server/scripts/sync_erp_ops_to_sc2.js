const mysql = require('../services/mysqlService');

async function syncErpOpsToSc2() {
    console.log('🔄 Sincronizando erp_ordens_producao para sc2010...');
    const [ops] = await mysql.query(`
        SELECT 
            numero_op,
            produto_codigo,
            quantidade_planejada,
            pedido_venda,
            item_pedido,
            data_emissao,
            data_inicio_prevista,
            data_fim_prevista,
            status,
            observacoes
        FROM erp_ordens_producao
    `);

    console.log(`Total de OPs em erp_ordens_producao: ${ops.length}`);

    const batchSize = 2000;
    for (let i = 0; i < ops.length; i += batchSize) {
        const slice = ops.slice(i, i + batchSize);
        const values = [];

        for (const op of slice) {
            const fullOp = String(op.numero_op || '').trim();
            if (fullOp.length < 11) continue;

            const num = fullOp.substring(0, 6);
            const item = fullOp.substring(6, 8);
            const seq = fullOp.substring(8, 11);

            const dEmissao = op.data_emissao ? String(op.data_emissao).substring(0, 10).replace(/-/g, '') : '';
            const dIni = op.data_inicio_prevista ? String(op.data_inicio_prevista).substring(0, 10).replace(/-/g, '') : '';
            const dFim = op.data_fim_prevista ? String(op.data_fim_prevista).substring(0, 10).replace(/-/g, '') : '';

            values.push([
                '0101', num, item, seq, op.produto_codigo,
                '01', op.quantidade_planejada || 0, 'UN', dIni, dFim,
                (op.observacoes || '').substring(0, 100), dEmissao, '500', 0, 'P',
                0, '01', '', op.pedido_venda || '', op.item_pedido || '',
                'F', fullOp, ''
            ]);
        }

        if (values.length > 0) {
            await mysql.query(`
                INSERT INTO sc2010 (
                    c2_filial, c2_num, c2_item, c2_sequen, c2_produto,
                    c2_local, c2_quant, c2_um, c2_datpri, c2_datprf,
                    c2_obs, c2_emissao, c2_prior, c2_quje, c2_status,
                    c2_perda, c2_roteiro, c2_recurso, c2_pedido, c2_itempv,
                    c2_tpop, c2_op, d_e_l_e_t_
                ) VALUES ?
                ON DUPLICATE KEY UPDATE
                    c2_quant = VALUES(c2_quant),
                    c2_pedido = VALUES(c2_pedido),
                    c2_itempv = VALUES(c2_itempv)
            `, [values]);
        }
        console.log(`Sincronizados ${Math.min(i + batchSize, ops.length)} / ${ops.length}...`);
    }

    console.log('🔄 Sincronizando erp_ordens_producao_materiais para sd4010...');
    const [mats] = await mysql.query(`
        SELECT 
            numero_op,
            produto_pai,
            componente_codigo,
            quantidade_necessaria,
            armazem
        FROM erp_ordens_producao_materiais
    `);

    if (mats.length > 0) {
        const matValues = mats.map(m => [
            '0101', m.componente_codigo, m.armazem || '01', m.numero_op,
            new Date().toISOString().substring(0, 10).replace(/-/g, ''),
            m.quantidade_necessaria, m.quantidade_necessaria, '', '',
            m.produto_pai, '01', '', m.quantidade_necessaria, ''
        ]);

        await mysql.query(`
            INSERT INTO sd4010 (
                d4_filial, d4_cod, d4_local, d4_op, d4_data,
                d4_qtdeori, d4_quant, d4_trt, d4_oporig, d4_produto,
                d4_roteiro, d4_operac, d4_qtneces, d_e_l_e_t_
            ) VALUES ?
        `, [matValues]);
    }
    console.log(`✅ ${mats.length} materiais sincronizados em sd4010.`);
    console.log('🎉 Sincronização concluída com sucesso!');
    process.exit(0);
}

syncErpOpsToSc2().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
