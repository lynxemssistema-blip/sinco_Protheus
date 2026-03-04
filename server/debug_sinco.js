const pool = require('./services/mysqlService');

async function testQuery() {
    try {
        console.log('Testing Sinco OS Query...');

        let query = `
            SELECT 
                IdOrdemServico,
                Projeto,
                Tag,
                DescTag,
                Descricao,
                EnderecoOrdemServico,
                CriadoPor,
                DataCriacao,
                Estatus,
                Liberado_Engenharia,
                Data_Liberacao_Engenharia,
                DescEmpresa as Cliente, 
                AreaPinturaTotal,
                PesoTotal,
                OrdemServicoFinalizado,
                DataFinalizado,
                DataFinalizacao
            FROM ordemservico 
            WHERE 1=1 AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E = '')
        `;

        const params = [];

        // Simulate default call (no filters)
        query += ` ORDER BY IdOrdemServico DESC LIMIT 50`;

        console.log('Query:', query);
        const [rows] = await pool.query(query, params);
        console.log(`Success! Found ${rows.length} rows.`);
        if (rows.length > 0) console.log('First row:', rows[0]);

        process.exit(0);

    } catch (error) {
        console.error('❌ SQL Error:', error);
        process.exit(1);
    }
}

testQuery();
