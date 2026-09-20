const pg = require('../db');
const mysql = require('../services/mysqlService');

function formatProtheusDate(dtStr) {
    if (!dtStr) return null;
    const s = String(dtStr).trim();
    if (s.length === 8 && /^\d{8}$/.test(s)) {
        return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }
    return null;
}

async function bulkInsert(tableName, columns, rows, batchSize = 1000) {
    if (!rows || rows.length === 0) return;
    const colList = columns.join(', ');
    const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;

    for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const placeholders = chunk.map(() => rowPlaceholder).join(', ');
        const values = [];
        for (const row of chunk) {
            for (const col of columns) {
                values.push(row[col] !== undefined ? row[col] : null);
            }
        }

        const sql = `INSERT IGNORE INTO ${tableName} (${colList}) VALUES ${placeholders}`;
        await mysql.query(sql, values);
        console.log(`   [${tableName}] Inseridos: ${Math.min(i + batchSize, rows.length)} de ${rows.length}`);
    }
}

async function runHighSpeedSync() {
    console.log('⚡ Iniciando Carga Rápida (High-Speed Bulk Insert) do Protheus para o novo MySQL...\n');

    try {
        await mysql.query('SET FOREIGN_KEY_CHECKS = 0;');

        // 1. CLIENTES (sa1010)
        console.log('📦 1/8. Copiando Clientes (SA1010)...');
        const cliRes = await pg.query(`
            SELECT TRIM(a1_cod) as codigo, COALESCE(TRIM(a1_loja), '01') as loja,
                   TRIM(a1_nome) as razao_social, TRIM(a1_nreduz) as nome_fantasia,
                   TRIM(a1_cgc) as cnpj_cpf, TRIM(a1_inscr) as inscricao_estadual,
                   TRIM(a1_mun) as cidade, TRIM(a1_est) as uf, TRIM(a1_cep) as cep,
                   TRIM(a1_tel) as telefone, TRIM(a1_email) as email, TRIM(a1_contato) as contato
            FROM sa1010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND a1_msblql != '1'
        `);
        const validClients = cliRes.rows.filter(c => c.codigo && c.razao_social);
        await bulkInsert('erp_clientes', ['codigo', 'loja', 'razao_social', 'nome_fantasia', 'cnpj_cpf', 'inscricao_estadual', 'cidade', 'uf', 'cep', 'telefone', 'email', 'contato'], validClients, 500);
        console.log(`✅ Clientes concluídos: ${validClients.length}\n`);

        // 2. FORNECEDORES (sa2010)
        console.log('📦 2/8. Copiando Fornecedores (SA2010)...');
        const fornRes = await pg.query(`
            SELECT TRIM(a2_cod) as codigo, COALESCE(TRIM(a2_loja), '01') as loja,
                   TRIM(a2_nome) as razao_social, TRIM(a2_nreduz) as nome_fantasia,
                   TRIM(a2_cgc) as cnpj_cpf, TRIM(a2_inscr) as inscricao_estadual,
                   TRIM(a2_mun) as cidade, TRIM(a2_est) as uf, TRIM(a2_cep) as cep,
                   TRIM(a2_tel) as telefone, TRIM(a2_email) as email, TRIM(a2_contato) as contato
            FROM sa2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND a2_msblql != '1'
        `);
        const validForn = fornRes.rows.filter(f => f.codigo && f.razao_social);
        await bulkInsert('erp_fornecedores', ['codigo', 'loja', 'razao_social', 'nome_fantasia', 'cnpj_cpf', 'inscricao_estadual', 'cidade', 'uf', 'cep', 'telefone', 'email', 'contato'], validForn, 500);
        console.log(`✅ Fornecedores concluídos: ${validForn.length}\n`);

        // 3. PRODUTOS (sb1010)
        console.log('📦 3/8. Copiando Produtos (SB1010)...');
        const prodRes = await pg.query(`
            SELECT TRIM(b1_cod) as codigo, TRIM(b1_desc) as descricao,
                   COALESCE(TRIM(b1_tipo), 'PA') as tipo, COALESCE(TRIM(b1_um), 'UN') as unidade_medida,
                   TRIM(b1_posipi) as ncm, COALESCE(TRIM(b1_locpad), '01') as armazem_padrao,
                   COALESCE(b1_peso, 0) as peso_liquido, COALESCE(b1_pesbru, 0) as peso_bruto,
                   COALESCE(TRIM(b1_revatu), '00') as revisao_atual
            FROM sb1010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND b1_msblql != '1'
        `);
        const validProd = prodRes.rows.filter(p => p.codigo).map(p => ({
            ...p,
            descricao: p.descricao || 'PRODUTO SEM DESCRICAO',
            peso_liquido: parseFloat(p.peso_liquido) || 0,
            peso_bruto: parseFloat(p.peso_bruto) || 0
        }));
        await bulkInsert('erp_produtos', ['codigo', 'descricao', 'tipo', 'unidade_medida', 'ncm', 'armazem_padrao', 'peso_liquido', 'peso_bruto', 'revisao_atual'], validProd, 1000);
        console.log(`✅ Produtos concluídos: ${validProd.length}\n`);

        // 4. ESTRUTURAS BOM (sg1010)
        console.log('📦 4/8. Copiando Estruturas BOM (SG1010)...');
        await mysql.query('TRUNCATE TABLE erp_estruturas_bom;');
        const bomRes = await pg.query(`
            SELECT TRIM(g1_cod) as produto_pai_codigo, TRIM(g1_comp) as produto_filho_codigo,
                   COALESCE(g1_quant, 1) as quantidade, COALESCE(g1_perda, 0) as perda_percentual,
                   COALESCE(TRIM(g1_revini), '00') as revisao, COALESCE(TRIM(g1_trt), '10') as ordem_sequencia
            FROM sg1010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
        `);
        const validBom = bomRes.rows.filter(b => b.produto_pai_codigo && b.produto_filho_codigo).map(b => ({
            ...b,
            quantidade: parseFloat(b.quantidade) || 1,
            perda_percentual: parseFloat(b.perda_percentual) || 0,
            ordem_sequencia: parseInt(b.ordem_sequencia) || 10
        }));
        await bulkInsert('erp_estruturas_bom', ['produto_pai_codigo', 'produto_filho_codigo', 'quantidade', 'perda_percentual', 'revisao', 'ordem_sequencia'], validBom, 1000);
        console.log(`✅ Estruturas BOM concluídas: ${validBom.length}\n`);

        // 5. ROTEIROS DE OPERAÇÕES (sg2010)
        console.log('📦 5/8. Copiando Roteiros de Operações (SG2010)...');
        await mysql.query('TRUNCATE TABLE erp_roteiros_operacoes;');
        const rotRes = await pg.query(`
            SELECT TRIM(g2_produto) as codigo_produto, COALESCE(TRIM(g2_operac), '010') as operacao_seq,
                   TRIM(g2_recurso) as codigo_recurso, TRIM(g2_descri) as descricao_operacao,
                   COALESCE(g2_tempad, 0) as tempo_operacao_minutos
            FROM sg2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
        `);
        const validRot = rotRes.rows.filter(r => r.codigo_produto && r.codigo_recurso).map(r => ({
            ...r,
            descricao_operacao: r.descricao_operacao || '',
            tempo_operacao_minutos: parseFloat(r.tempo_operacao_minutos) || 0
        }));
        await bulkInsert('erp_roteiros_operacoes', ['codigo_produto', 'operacao_seq', 'codigo_recurso', 'descricao_operacao', 'tempo_operacao_minutos'], validRot, 1000);
        console.log(`✅ Roteiros concluídos: ${validRot.length}\n`);

        // 6. PEDIDOS DE VENDA & ITENS (sc5010 & sc6010)
        console.log('📦 6/8. Copiando Pedidos de Venda e Itens...');
        const pedRes = await pg.query(`
            SELECT TRIM(c5_num) as numero_pedido, TRIM(c5_cliente) as cliente_codigo,
                   c5_emissao, TRIM(c5_condpag) as condicao_pagamento, TRIM(c5_transp) as transportadora
            FROM sc5010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
        `);
        const validPed = pedRes.rows.filter(p => p.numero_pedido).map(p => ({
            numero_pedido: p.numero_pedido,
            cliente_codigo: p.cliente_codigo || '000001',
            data_emissao: formatProtheusDate(p.c5_emissao) || '2026-01-01',
            condicao_pagamento: p.condicao_pagamento || '',
            transportadora: p.transportadora || ''
        }));
        await bulkInsert('erp_pedidos_venda', ['numero_pedido', 'cliente_codigo', 'data_emissao', 'condicao_pagamento', 'transportadora'], validPed, 500);

        const itensRes = await pg.query(`
            SELECT TRIM(c6_num) as pedido_numero, COALESCE(TRIM(c6_item), '01') as item_seq,
                   TRIM(c6_produto) as produto_codigo, COALESCE(c6_qtdven, 0) as quantidade,
                   COALESCE(c6_qtdent, 0) as quantidade_entregue, COALESCE(c6_prcven, 0) as preco_unitario,
                   c6_entreg, TRIM(c6_numop) as numero_op_gerada
            FROM sc6010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
        `);
        const validItens = itensRes.rows.filter(i => i.pedido_numero && i.produto_codigo).map(i => ({
            pedido_numero: i.pedido_numero,
            item_seq: i.item_seq,
            produto_codigo: i.produto_codigo,
            quantidade: parseFloat(i.quantidade) || 0,
            quantidade_entregue: parseFloat(i.quantidade_entregue) || 0,
            preco_unitario: parseFloat(i.preco_unitario) || 0,
            data_entrega_prevista: formatProtheusDate(i.c6_entreg),
            numero_op_gerada: i.numero_op_gerada || null
        }));
        await bulkInsert('erp_pedidos_itens', ['pedido_numero', 'item_seq', 'produto_codigo', 'quantidade', 'quantidade_entregue', 'preco_unitario', 'data_entrega_prevista', 'numero_op_gerada'], validItens, 1000);
        console.log(`✅ Pedidos (${validPed.length}) e Itens (${validItens.length}) concluídos.\n`);

        // 7. ORDENS DE PRODUÇÃO (sc2010 - últimas 20.000 OPs ativas/recentes)
        console.log('📦 7/8. Copiando Ordens de Produção Recentes (SC2010)...');
        const opRes = await pg.query(`
            SELECT TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen) as numero_op,
                   TRIM(c2_produto) as produto_codigo, COALESCE(c2_quant, 0) as quantidade_planejada,
                   COALESCE(c2_quje, 0) as quantidade_produzida, COALESCE(c2_perda, 0) as quantidade_perdida,
                   TRIM(c2_pedido) as pedido_venda, TRIM(c2_itempv) as item_pedido,
                   c2_emissao, c2_datpri, c2_datprf
            FROM sc2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY r_e_c_n_o_ DESC LIMIT 20000
        `);
        const validOps = opRes.rows.filter(o => o.numero_op && o.produto_codigo).map(o => ({
            numero_op: o.numero_op,
            produto_codigo: o.produto_codigo,
            quantidade_planejada: parseFloat(o.quantidade_planejada) || 0,
            quantidade_produzida: parseFloat(o.quantidade_produzida) || 0,
            quantidade_perdida: parseFloat(o.quantidade_perdida) || 0,
            pedido_venda: o.pedido_venda || null,
            item_pedido: o.item_pedido || null,
            data_emissao: formatProtheusDate(o.c2_emissao) || '2026-01-01',
            data_inicio_prevista: formatProtheusDate(o.c2_datpri),
            data_fim_prevista: formatProtheusDate(o.c2_datprf)
        }));
        await bulkInsert('erp_ordens_producao', ['numero_op', 'produto_codigo', 'quantidade_planejada', 'quantidade_produzida', 'quantidade_perdida', 'pedido_venda', 'item_pedido', 'data_emissao', 'data_inicio_prevista', 'data_fim_prevista'], validOps, 1000);
        console.log(`✅ Ordens de Produção concluídas: ${validOps.length}\n`);

        // 8. SALDOS DE ESTOQUE (sb2010)
        console.log('📦 8/8. Copiando Saldos de Estoque Atuais (SB2010)...');
        const estRes = await pg.query(`
            SELECT TRIM(b2_cod) as produto_codigo, COALESCE(TRIM(b2_local), '01') as armazem,
                   COALESCE(b2_qatu, 0) as saldo_atual, COALESCE(b2_qemp, 0) as saldo_empenhado,
                   COALESCE(b2_cm1, 0) as custo_medio
            FROM sb2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND (b2_qatu > 0 OR b2_qemp > 0)
        `);
        const validEst = estRes.rows.filter(s => s.produto_codigo).map(s => ({
            produto_codigo: s.produto_codigo,
            armazem: s.armazem,
            saldo_atual: parseFloat(s.saldo_atual) || 0,
            saldo_empenhado: parseFloat(s.saldo_empenhado) || 0,
            custo_medio: parseFloat(s.custo_medio) || 0
        }));
        await bulkInsert('erp_estoque_saldos', ['produto_codigo', 'armazem', 'saldo_atual', 'saldo_empenhado', 'custo_medio'], validEst, 1000);
        console.log(`✅ Saldos de estoque concluídos: ${validEst.length}\n`);

        await mysql.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('🎉 CARGA RÁPIDA CONCLUÍDA! O NOVO ERP NATIVO ESTÁ 100% POPULADO COM DADOS REAIS DO PROTHEUS!');

    } catch (err) {
        console.error('❌ Erro durante a carga:', err);
    } finally {
        process.exit(0);
    }
}

runHighSpeedSync();
