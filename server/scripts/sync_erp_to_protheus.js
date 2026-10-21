const pool = require('../services/mysqlService');

async function syncErpToProtheus() {
    console.log('🔄 Sincronizando dados nativos do ERP para as tabelas Protheus (SA1, SB1, SC5, SC6, SG1, SG2, SZ1)...');

    // 0. Auto-ajuste de schema Protheus: garante AUTO_INCREMENT em r_e_c_n_o_ de sz1010
    try {
        const [cols] = await pool.query("SHOW COLUMNS FROM sz1010 LIKE 'r_e_c_n_o_'");
        if (cols && cols[0] && !cols[0].Extra?.includes('auto_increment')) {
            await pool.query('UPDATE sz1010 SET r_e_c_n_o_ = 1 WHERE r_e_c_n_o_ = 0');
            await pool.query('ALTER TABLE sz1010 MODIFY COLUMN r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT');
            console.log('✅ [SYNC] Tabela sz1010 ajustada para AUTO_INCREMENT.');
        }
    } catch (e) {
        console.warn('⚠️ [SYNC] Aviso ao verificar AUTO_INCREMENT de sz1010:', e.message);
    }

    // 1. Clientes (erp_clientes -> sa1010)
    try {
        const [clis] = await pool.query('SELECT * FROM erp_clientes');
        for (const c of clis) {
            const codigo = String(c.codigo || '').trim().padStart(6, '0');
            const loja = String(c.loja || '01').trim().padStart(2, '0');
            const [[existing]] = await pool.query('SELECT r_e_c_n_o_ FROM sa1010 WHERE a1_cod = ? AND a1_loja = ? AND IdEmpresa = ? LIMIT 1', [codigo, loja, c.IdEmpresa || 1]);
            if (existing) {
                await pool.query(
                    `UPDATE sa1010 SET a1_nome = ?, a1_nreduz = ?, a1_cgc = ?, a1_mun = ?, a1_est = ?, a1_cep = ?, a1_tel = ?, a1_email = ?, a1_contato = ?
                     WHERE r_e_c_n_o_ = ?`,
                    [c.razao_social || 'CLIENTE SEM RAZAO', c.nome_fantasia || c.razao_social || 'CLIENTE', c.cnpj_cpf || '', c.cidade || '', c.uf || '', c.cep || '', c.telefone || '', c.email || '', c.contato || '', existing.r_e_c_n_o_]
                );
            } else {
                await pool.query(
                    `INSERT INTO sa1010 (a1_filial, a1_cod, a1_loja, a1_nome, a1_nreduz, a1_cgc, a1_mun, a1_est, a1_cep, a1_tel, a1_email, a1_contato, d_e_l_e_t_, IdEmpresa)
                     VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
                    [codigo, loja, c.razao_social || 'CLIENTE SEM RAZAO', c.nome_fantasia || c.razao_social || 'CLIENTE', c.cnpj_cpf || '', c.cidade || '', c.uf || '', c.cep || '', c.telefone || '', c.email || '', c.contato || '', c.IdEmpresa || 1]
                );
            }
        }
        console.log(`✅ ${clis.length} cliente(s) sincronizado(s) em sa1010.`);
    } catch (errCli) {
        console.warn('⚠️ [SYNC] Falha ao sincronizar clientes:', errCli.message);
    }

    // 2. Produtos (erp_produtos -> sb1010)
    try {
        const [prods] = await pool.query('SELECT * FROM erp_produtos');
        for (const p of prods) {
            const revProd = String(p.b1_xrevm || '0').trim();
            const desCli = String(p.b1_xproc1 || '').trim();
            const revCli = String(p.b1_xrevc || '0').trim();
            const [[existing]] = await pool.query('SELECT r_e_c_n_o_ FROM sb1010 WHERE b1_cod = ? AND IdEmpresa = ? LIMIT 1', [p.codigo, p.IdEmpresa || 1]);
            if (existing) {
                await pool.query(
                    `UPDATE sb1010 SET b1_desc = ?, b1_tipo = ?, b1_um = ?, b1_posipi = ?, b1_locpad = ?, b1_peso = ?, b1_pesbru = ?, b1_revatu = ?, b1_xrevm = ?, b1_xproc1 = ?, b1_xrevc = ?
                     WHERE r_e_c_n_o_ = ?`,
                    [p.descricao || '', p.tipo || 'PA', p.unidade_medida || 'UN', p.ncm || '', p.armazem_padrao || '01', p.peso_liquido || 0, p.peso_bruto || 0, p.revisao_atual || '00', revProd, desCli, revCli, existing.r_e_c_n_o_]
                );
            } else {
                await pool.query(
                    `INSERT INTO sb1010 (b1_filial, b1_cod, b1_desc, b1_tipo, b1_um, b1_posipi, b1_locpad, b1_peso, b1_pesbru, b1_revatu, b1_xrevm, b1_xproc1, b1_xrevc, d_e_l_e_t_, IdEmpresa)
                     VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
                    [p.codigo, p.descricao || '', p.tipo || 'PA', p.unidade_medida || 'UN', p.ncm || '', p.armazem_padrao || '01', p.peso_liquido || 0, p.peso_bruto || 0, p.revisao_atual || '00', revProd, desCli, revCli, p.IdEmpresa || 1]
                );
            }

            // Sincroniza também sz1010 (Referência / Desenho do Cliente)
            if (desCli) {
                const [[sz1Exist]] = await pool.query('SELECT r_e_c_n_o_ FROM sz1010 WHERE z1_produto = ? AND IdEmpresa = ? LIMIT 1', [p.codigo, p.IdEmpresa || 1]);
                if (sz1Exist) {
                    await pool.query('UPDATE sz1010 SET z1_codcli = ?, z1_revisao = ? WHERE r_e_c_n_o_ = ?', [desCli, revCli, sz1Exist.r_e_c_n_o_]);
                } else {
                    await pool.query(
                        `INSERT INTO sz1010 (z1_filial, z1_cliente, z1_loja, z1_nomecli, z1_produto, z1_codcli, z1_desccli, z1_revisao, z1_tes, d_e_l_e_t_, IdEmpresa)
                         VALUES ('0101', '000001', '01', '', ?, ?, '', ?, '', '', ?)`,
                        [p.codigo, desCli, revCli, p.IdEmpresa || 1]
                    );
                }
            }
        }
        console.log(`✅ ${prods.length} produto(s) sincronizado(s) em sb1010.`);
    } catch (errProd) {
        console.warn('⚠️ [SYNC] Falha ao sincronizar produtos:', errProd.message);
    }

    // 3. Pedidos de Venda (erp_pedidos_venda -> sc5010)
    try {
        const [peds] = await pool.query('SELECT * FROM erp_pedidos_venda');
        for (const p of peds) {
            const num = String(p.numero_pedido).trim().padStart(6, '0');
            const emissao = p.data_emissao ? new Date(p.data_emissao).toISOString().slice(0, 10).replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const cli = String(p.cliente_codigo || '000001').trim().padStart(6, '0');
            const [[existing]] = await pool.query('SELECT r_e_c_n_o_ FROM sc5010 WHERE c5_num = ? AND IdEmpresa = ? LIMIT 1', [num, p.IdEmpresa || 1]);
            if (existing) {
                await pool.query(
                    `UPDATE sc5010 SET c5_cliente = ?, c5_condpag = ?, c5_emissao = ?, c5_mennota = ?, c5_pesol = ?, c5_pbruto = ?
                     WHERE r_e_c_n_o_ = ?`,
                    [cli, p.condicao_pagamento || '', emissao, p.observacoes || '', p.peso_total || 0, p.peso_total || 0, existing.r_e_c_n_o_]
                );
            } else {
                await pool.query(
                    `INSERT INTO sc5010 (c5_filial, c5_num, c5_tipo, c5_cliente, c5_lojacli, c5_condpag, c5_emissao, c5_mennota, c5_pesol, c5_pbruto, d_e_l_e_t_, IdEmpresa)
                     VALUES ('0101', ?, 'N', ?, '01', ?, ?, ?, ?, ?, '', ?)`,
                    [num, cli, p.condicao_pagamento || '', emissao, p.observacoes || '', p.peso_total || 0, p.peso_total || 0, p.IdEmpresa || 1]
                );
            }
        }
        console.log(`✅ ${peds.length} pedido(s) sincronizado(s) em sc5010.`);
    } catch (errPed) {
        console.warn('⚠️ [SYNC] Falha ao sincronizar pedidos de venda:', errPed.message);
    }

    // 4. Itens do Pedido (erp_pedidos_itens -> sc6010)
    try {
        const [itens] = await pool.query(`
            SELECT it.*, pv.pedido_cliente as ped_cli_venda,
                   p.b1_xrevm, p.b1_xproc1, p.b1_xrevc
            FROM erp_pedidos_itens it
            LEFT JOIN erp_pedidos_venda pv 
              ON (pv.numero_pedido = it.pedido_numero OR CAST(pv.numero_pedido AS UNSIGNED) = CAST(it.pedido_numero AS UNSIGNED))
             AND pv.IdEmpresa = it.IdEmpresa
            LEFT JOIN erp_produtos p
              ON p.codigo = it.produto_codigo
        `);

        for (const it of itens) {
            const num = String(it.pedido_numero).trim().padStart(6, '0');
            const seq = String(it.item_seq).trim().padStart(2, '0');
            const entreg = it.data_entrega_prevista ? new Date(it.data_entrega_prevista).toISOString().slice(0, 10).replace(/-/g, '') : '';
            const pedCli = String(it.pedido_cliente || it.ped_cli_venda || '').trim();
            const revProd = String(it.c6_xrevm || it.b1_xrevm || '0').trim();
            const desCli = String(it.c6_xproc1 || it.b1_xproc1 || '').trim();
            const revCli = String(it.c6_xrevc || it.b1_xrevc || '0').trim();

            const [[existing]] = await pool.query('SELECT r_e_c_n_o_ FROM sc6010 WHERE c6_num = ? AND c6_item = ? AND IdEmpresa = ? LIMIT 1', [num, seq, it.IdEmpresa || 1]);
            if (existing) {
                await pool.query(
                    `UPDATE sc6010 SET c6_produto = ?, c6_qtdven = ?, c6_prcven = ?, c6_valor = ?, c6_qtdent = ?, c6_entreg = ?, c6_pedcli = ?, c6_xrevm = ?, c6_xproc1 = ?, c6_xrevc = ?
                     WHERE r_e_c_n_o_ = ?`,
                    [it.produto_codigo, it.quantidade, it.preco_unitario, it.valor_total, it.quantidade_entregue || 0, entreg, pedCli, revProd, desCli, revCli, existing.r_e_c_n_o_]
                );
            } else {
                await pool.query(
                    `INSERT INTO sc6010 (c6_filial, c6_num, c6_item, c6_produto, c6_um, c6_qtdven, c6_prcven, c6_valor, c6_qtdent, c6_entreg, c6_cli, c6_loja, c6_pedcli, c6_xrevm, c6_xproc1, c6_xrevc, d_e_l_e_t_, IdEmpresa)
                     VALUES ('0101', ?, ?, ?, 'UN', ?, ?, ?, ?, ?, '000001', '01', ?, ?, ?, ?, '', ?)`,
                    [num, seq, it.produto_codigo, it.quantidade, it.preco_unitario, it.valor_total, it.quantidade_entregue || 0, entreg, pedCli, revProd, desCli, revCli, it.IdEmpresa || 1]
                );
            }
        }
        console.log(`✅ ${itens.length} item(ns) sincronizado(s) em sc6010.`);
    } catch (errItens) {
        console.warn('⚠️ [SYNC] Falha ao sincronizar itens de pedidos:', errItens.message);
    }

    // 5. Estruturas BOM (erp_estruturas_bom -> sg1010)
    try {
        const [boms] = await pool.query('SELECT * FROM erp_estruturas_bom WHERE ativo = 1');
        for (const b of boms) {
            const [[existing]] = await pool.query(
                'SELECT r_e_c_n_o_ FROM sg1010 WHERE g1_cod = ? AND g1_comp = ? AND IdEmpresa = ? LIMIT 1',
                [b.produto_pai_codigo, b.produto_filho_codigo, b.IdEmpresa || 1]
            );
            if (existing) {
                await pool.query(
                    `UPDATE sg1010 SET g1_quant = ?, g1_perda = ?, g1_trt = ? WHERE r_e_c_n_o_ = ?`,
                    [b.quantidade, b.perda_percentual || 0, String(b.ordem_sequencia || '01').padStart(3, '0'), existing.r_e_c_n_o_]
                );
            } else {
                await pool.query(
                    `INSERT INTO sg1010 (g1_filial, g1_cod, g1_comp, g1_trt, g1_quant, g1_perda, g1_ini, g1_fim, g1_revini, g1_revfim, d_e_l_e_t_, IdEmpresa)
                     VALUES ('0101', ?, ?, ?, ?, ?, '20200101', '20991231', '00', '99', '', ?)`,
                    [b.produto_pai_codigo, b.produto_filho_codigo, String(b.ordem_sequencia || '01').padStart(3, '0'), b.quantidade, b.perda_percentual || 0, b.IdEmpresa || 1]
                );
            }
        }
        console.log(`✅ ${boms.length} estrutura(s) BOM sincronizada(s) em sg1010.`);
    } catch (errBom) {
        console.warn('⚠️ [SYNC] Falha ao sincronizar estruturas BOM:', errBom.message);
    }

    // 6. Roteiros de Operações (erp_roteiros_operacoes -> sg2010)
    try {
        const [rots] = await pool.query('SELECT * FROM erp_roteiros_operacoes');
        for (const r of rots) {
            const seq = String(r.operacao_seq || '10').trim().padStart(2, '0');
            const [[existing]] = await pool.query(
                'SELECT r_e_c_n_o_ FROM sg2010 WHERE g2_produto = ? AND g2_operac = ? AND IdEmpresa = ? LIMIT 1',
                [r.codigo_produto, seq, r.IdEmpresa || 1]
            );
            if (existing) {
                await pool.query(
                    `UPDATE sg2010 SET g2_recurso = ?, g2_descri = ?, g2_setup = ?, g2_tempad = ? WHERE r_e_c_n_o_ = ?`,
                    [r.codigo_recurso || '', r.descricao_operacao || '', r.tempo_setup_minutos || 0, r.tempo_operacao_minutos || 0, existing.r_e_c_n_o_]
                );
            } else {
                await pool.query(
                    `INSERT INTO sg2010 (g2_filial, g2_codigo, g2_produto, g2_operac, g2_recurso, g2_descri, g2_setup, g2_tempad, d_e_l_e_t_, IdEmpresa)
                     VALUES ('0101', '01', ?, ?, ?, ?, ?, ?, '', ?)`,
                    [r.codigo_produto, seq, r.codigo_recurso || '', r.descricao_operacao || '', r.tempo_setup_minutos || 0, r.tempo_operacao_minutos || 0, r.IdEmpresa || 1]
                );
            }
        }
        console.log(`✅ ${rots.length} roteiro(s) de operação sincronizado(s) em sg2010.`);
    } catch (errRoteiro) {
        console.warn('⚠️ [SYNC] Falha ao sincronizar roteiros:', errRoteiro.message);
    }

    console.log('🎉 Sincronização ERP -> Protheus concluída com sucesso!');
}

module.exports = { syncErpToProtheus };

if (require.main === module) {
    syncErpToProtheus()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Erro na sincronização:', err);
            process.exit(1);
        });
}
