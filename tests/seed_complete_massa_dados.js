/**
 * tests/seed_complete_massa_dados.js
 * Injeção de Massa de Dados Robusta e Completa para o SINCO PROTHEUS
 * Preenche todas as tabelas vazias do sistema para alimentar 100% das telas:
 * - Faturamento (Solicitações, Itens, Pré-etiquetas)
 * - Estoque (SB2010 - Saldos Físicos e Financeiros)
 * - Fornecedores (ERP Fornecedores e SA2010)
 * - Chão de Fábrica (Apontamentos de Produção, Histórico de Tempos)
 * - Necessidades de Materiais (MRP / Almoxarifado)
 * - SGQ (Não conformidades RNC, Ações Corretivas)
 * 
 * Regra: Total isolamento no MySQL u494795077_SINCO com IdEmpresa = 1
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const db = require('../server/services/mysqlService');

async function seed() {
    console.log('🚀 [SEED] Iniciando injeção de massa de dados completa no SINCO PROTHEUS...');

    // 1. FORNECEDORES (erp_fornecedores e sa2010)
    console.log('📦 Injetando Fornecedores industriais...');
    const fornecedores = [
        {
            codigo: '000001',
            loja: '01',
            razao_social: 'GERDAU ACOSMINAS S/A',
            nome_fantasia: 'GERDAU AÇOS LONGOS',
            cnpj_cpf: '07.358.761/0001-69',
            inscricao_estadual: '148.234.567.890',
            endereco: 'AV DAS NACOES UNIDAS, 12551',
            bairro: 'BROOKLIN NOVO',
            cidade: 'SAO PAULO',
            uf: 'SP',
            cep: '04578-903',
            telefone: '(11) 3094-6600',
            email: 'vendas.industria@gerdau.com.br',
            contato: 'Carlos Eduardo Mendes',
            status: 'ativo'
        },
        {
            codigo: '000002',
            loja: '01',
            razao_social: 'APERAM SOUTH AMERICA S/A',
            nome_fantasia: 'APERAM INOX',
            cnpj_cpf: '17.262.213/0001-94',
            inscricao_estadual: '062.112.334.001',
            endereco: 'PCA PRIMEIRO DE MAIO, 9',
            bairro: 'CENTRO',
            cidade: 'TIMOTEO',
            uf: 'MG',
            cep: '35180-018',
            telefone: '(31) 3849-7000',
            email: 'atendimento@aperam.com',
            contato: 'Mariana Silveira',
            status: 'ativo'
        },
        {
            codigo: '000003',
            loja: '01',
            razao_social: 'IBRAMETAL INDUSTRIA DE METAIS LTDA',
            nome_fantasia: 'IBRAMETAL BRONZES',
            cnpj_cpf: '54.321.987/0001-44',
            inscricao_estadual: '334.887.990.112',
            endereco: 'RUA DOS FUNDIDORES, 450',
            bairro: 'DISTRITO INDUSTRIAL',
            cidade: 'JOINVILLE',
            uf: 'SC',
            cep: '89219-600',
            telefone: '(47) 3451-2200',
            email: 'pedidos@ibrametal.com.br',
            contato: 'Roberto Alencar',
            status: 'ativo'
        }
    ];

    for (const f of fornecedores) {
        await db.execute(`
            INSERT INTO erp_fornecedores (
                codigo, loja, razao_social, nome_fantasia, cnpj_cpf, inscricao_estadual,
                endereco, bairro, cidade, uf, cep, telefone, email, contato, status,
                created_at, updated_at, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)
            ON DUPLICATE KEY UPDATE razao_social = VALUES(razao_social), nome_fantasia = VALUES(nome_fantasia)
        `, [
            f.codigo, f.loja, f.razao_social, f.nome_fantasia, f.cnpj_cpf, f.inscricao_estadual,
            f.endereco, f.bairro, f.cidade, f.uf, f.cep, f.telefone, f.email, f.contato, f.status
        ]);

        await db.execute(`
            INSERT INTO sa2010 (
                a2_filial, a2_cod, a2_loja, a2_nome, a2_nreduz, a2_cgc, a2_est, a2_mun, a2_tipo,
                d_e_l_e_t_, IdEmpresa
            ) VALUES (
                '0101', ?, ?, ?, ?, ?, ?, ?, 'J', '', 1
            )
            ON DUPLICATE KEY UPDATE a2_nome = VALUES(a2_nome)
        `, [f.codigo, f.loja, f.razao_social, f.nome_fantasia, f.cnpj_cpf.replace(/\D/g, ''), f.uf, f.cidade]);
    }
    console.log(`✅ ${fornecedores.length} fornecedores inseridos com sucesso.`);

    // 2. SALDOS EM ESTOQUE (SB2010 - Almoxarifado 01)
    console.log('📊 Injetando Saldos de Estoque Físico e Financeiro (SB2010)...');
    const saldos = [
        { cod: 'MT2-0001', qatu: 1200, vatu: 3840.00, cm: 3.20 },
        { cod: 'MT2-0002', qatu: 450, vatu: 1035.00, cm: 2.30 },
        { cod: 'MT2-0003', qatu: 820, vatu: 2173.00, cm: 2.65 },
        { cod: 'PF-M10X80', qatu: 850, vatu: 12325.00, cm: 14.50 },
        { cod: 'PI-M10X80', qatu: 340, vatu: 2788.00, cm: 8.20 },
        { cod: 'MP-ACO1045-12', qatu: 150, vatu: 3300.00, cm: 22.00 },
        { cod: 'MP-OLEO-CORTE', qatu: 200, vatu: 3700.00, cm: 18.50 },
        { cod: 'EX-TRANS35', qatu: 35, vatu: 6475.00, cm: 185.00 },
        { cod: 'PI-EX-BRUTO', qatu: 60, vatu: 5700.00, cm: 95.00 },
        { cod: 'MP-ACO4140-50', qatu: 80, vatu: 6800.00, cm: 85.00 },
        { cod: 'BU-BRONZE30', qatu: 110, vatu: 5280.00, cm: 48.00 },
        { cod: 'MP-BRONZE-TM23', qatu: 45, vatu: 7200.00, cm: 160.00 }
    ];

    for (const s of saldos) {
        await db.execute(`
            INSERT INTO sb2010 (
                b2_filial, b2_cod, b2_local, b2_qatu, b2_vatu1, b2_cm1, b2_qemp, b2_reserva,
                d_e_l_e_t_, IdEmpresa
            ) VALUES (
                '0101', ?, '01', ?, ?, ?, 0, 0, '', 1
            )
            ON DUPLICATE KEY UPDATE b2_qatu = VALUES(b2_qatu), b2_vatu1 = VALUES(b2_vatu1), b2_cm1 = VALUES(b2_cm1)
        `, [s.cod, s.qatu, s.vatu, s.cm]);
    }
    console.log(`✅ ${saldos.length} saldos de estoque configurados.`);

    // 3. FATURAMENTO (Solicitações de Faturamento e Itens)
    console.log('💰 Injetando Solicitações de Faturamento reais...');
    // Limpa anteriores para evitar duplicação
    await db.execute('DELETE FROM app_faturamento_solicitacao_itens WHERE IdEmpresa = 1');
    await db.execute('DELETE FROM app_faturamento_solicitacoes WHERE IdEmpresa = 1');

    const solicitacoes = [
        {
            num: 'SOL-2026-001',
            usuario: 'Edson Manoel',
            status: 'atendido',
            obs: 'Faturamento de lote prioritário aprovado pelo cliente Delta',
            nf: '0001041',
            itens: [
                {
                    pedido: '000001',
                    item: '01',
                    cod: 'MT2-0001',
                    qtd: 100,
                    saldo: 100,
                    nf: '0001041',
                    pedcli: 'PO-956565',
                    desenho: 'DES-MT2-01',
                    cliente: 'DELTA PARAFUSOS & FIXADORES LTDA',
                    unit: 3.20,
                    total: 320.00
                }
            ]
        },
        {
            num: 'SOL-2026-002',
            usuario: 'Edson Manoel',
            status: 'pendente',
            obs: 'Aguardando validação da transportadora para entrega em Contagem',
            nf: null,
            itens: [
                {
                    pedido: '000002',
                    item: '01',
                    cod: 'PF-M10X80',
                    qtd: 200,
                    saldo: 200,
                    nf: null,
                    pedcli: 'PO-000002',
                    desenho: 'DES-PF-M10',
                    cliente: 'METALURGICA PROGRESSO INDUSTRIAL S/A',
                    unit: 14.50,
                    total: 2900.00
                },
                {
                    pedido: '000002',
                    item: '02',
                    cod: 'BU-BRONZE30',
                    qtd: 50,
                    saldo: 50,
                    nf: null,
                    pedcli: 'PO-000002',
                    desenho: 'DES-BU-30',
                    cliente: 'METALURGICA PROGRESSO INDUSTRIAL S/A',
                    unit: 48.00,
                    total: 2400.00
                }
            ]
        },
        {
            num: 'SOL-2026-003',
            usuario: 'Edson Manoel',
            status: 'faturado',
            obs: 'Mercadoria despachada com NFe emitida',
            nf: '0001042',
            itens: [
                {
                    pedido: '000003',
                    item: '01',
                    cod: 'EX-TRANS35',
                    qtd: 25,
                    saldo: 25,
                    nf: '0001042',
                    pedcli: 'PO-000003',
                    desenho: 'DES-EX-35',
                    cliente: 'AGROMAQ MAQUINAS E EQUIPAMENTOS AGRICOLAS LTDA',
                    unit: 185.00,
                    total: 4625.00
                }
            ]
        },
        {
            num: 'SOL-2026-004',
            usuario: 'Edson Manoel',
            status: 'cancelado',
            obs: 'Cancelado a pedido do departamento comercial por alteração de engenharia',
            nf: null,
            itens: [
                {
                    pedido: '000001',
                    item: '02',
                    cod: 'MT2-0001',
                    qtd: 50,
                    saldo: 50,
                    nf: null,
                    pedcli: 'PO-956565',
                    desenho: 'DES-MT2-01',
                    cliente: 'DELTA PARAFUSOS & FIXADORES LTDA',
                    unit: 3.20,
                    total: 160.00
                }
            ]
        }
    ];

    for (const sol of solicitacoes) {
        const [res] = await db.execute(`
            INSERT INTO app_faturamento_solicitacoes (
                numero_solicitacao, usuario, status, observacao, created_at, updated_at, nota_fiscal, IdEmpresa
            ) VALUES (?, ?, ?, ?, NOW(), NOW(), ?, 1)
        `, [sol.num, sol.usuario, sol.status, sol.obs, sol.nf]);

        const solId = res.insertId;

        for (const it of sol.itens) {
            await db.execute(`
                INSERT INTO app_faturamento_solicitacao_itens (
                    solicitacao_id, pedido, item, codigo_produto, quantidade_solicitada,
                    saldo_faturar_momentaneo, nota_fiscal, pedido_cliente, desenho_cliente,
                    nome_cliente, valor_unitario, valor_total, IdEmpresa
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
                solId, it.pedido, it.item, it.cod, it.qtd,
                it.saldo, it.nf, it.pedcli, it.desenho,
                it.cliente, it.unit, it.total
            ]);
        }
    }
    console.log(`✅ ${solicitacoes.length} solicitações de faturamento com seus itens criadas.`);

    // 4. PRÉ-ETIQUETAS DE EXPEDIÇÃO (faturamento_pre_etiquetas)
    console.log('🏷️ Injetando Pré-Etiquetas de Faturamento...');
    await db.execute('DELETE FROM faturamento_pre_etiquetas WHERE IdEmpresa = 1');
    const preEtiquetas = [
        {
            prod: 'EX-TRANS35',
            desc: 'EIXO DE TRANSMISSAO RANHURADO 35MM',
            ped: '000003',
            item: '01',
            op: '00000301',
            qtd: 20,
            criador: 'Edson Manoel',
            status: 'pendente',
            cliente: 'AGROMAQ MAQUINAS E EQUIPAMENTOS AGRICOLAS LTDA',
            cod_cli: '000003',
            ped_cli: 'PO-000003',
            ref_cli: 'REF-AGRO-35',
            rev: '0'
        },
        {
            prod: 'PF-M10X80',
            desc: 'PARAFUSO FLANGEADO M10 X 80 CLASSE 8.8',
            ped: '000002',
            item: '01',
            op: '00000201',
            qtd: 100,
            criador: 'Edson Manoel',
            status: 'impresso',
            cliente: 'METALURGICA PROGRESSO INDUSTRIAL S/A',
            cod_cli: '000002',
            ped_cli: 'PO-000002',
            ref_cli: 'FIX-M10',
            rev: '0'
        }
    ];

    for (const pe of preEtiquetas) {
        await db.execute(`
            INSERT INTO faturamento_pre_etiquetas (
                produto_codigo, produto_descricao, pedido, item, op_num,
                quantidade_solicitada, criado_por, criado_em, status,
                cliente, cod_cliente, ped_cliente, ref_cliente, revisao, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, 1)
        `, [
            pe.prod, pe.desc, pe.ped, pe.item, pe.op,
            pe.qtd, pe.criador, pe.status,
            pe.cliente, pe.cod_cli, pe.ped_cli, pe.ref_cli, pe.rev
        ]);
    }
    console.log(`✅ ${preEtiquetas.length} pré-etiquetas de expedição criadas.`);

    // 5. APONTAMENTOS DE PRODUÇÃO / CHÃO DE FÁBRICA (app_production_appointments)
    console.log('🏭 Injetando Apontamentos de Produção e Operações...');
    await db.execute('DELETE FROM app_production_appointments WHERE IdEmpresa = 1');
    const apontamentos = [
        {
            op: '00000301',
            item: '01',
            seq: '001',
            op_cod: 'USIN-CNC',
            rec: 'TORNO-01',
            prod: 'EX-TRANS35',
            user: 'Edson Manoel',
            qtd: 20,
            inicio: '2026-10-17 07:30:00',
            fim: '2026-10-17 11:45:00',
            obs: 'Primeira fase de torneamento bruto e faceamento concluída dentro da tolerância'
        },
        {
            op: '00000301',
            item: '01',
            seq: '002',
            op_cod: 'RANHURA',
            rec: 'FRESA-01',
            prod: 'EX-TRANS35',
            user: 'Edson Manoel',
            qtd: 15,
            inicio: '2026-10-17 13:00:00',
            fim: '2026-10-17 16:30:00',
            obs: 'Fresamento de estrias e ranhuras laterais com conferência de calibre'
        }
    ];

    for (const ap of apontamentos) {
        await db.execute(`
            INSERT INTO app_production_appointments (
                op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo,
                produto_codigo, usuario, quantidade, data_inicio, data_fim,
                observacao, created_at, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)
        `, [
            ap.op, ap.item, ap.seq, ap.op_cod, ap.rec,
            ap.prod, ap.user, ap.qtd, ap.inicio, ap.fim,
            ap.obs
        ]);
    }
    console.log(`✅ ${apontamentos.length} apontamentos de chão de fábrica criados.`);

    // 6. NECESSIDADES DE MATERIAIS (MRP - app_material_necessidades)
    console.log('🔩 Injetando Necessidades de Materiais MRP...');
    await db.execute('DELETE FROM app_material_necessidades WHERE IdEmpresa = 1');
    const necessidades = [
        {
            ped: '000003',
            it: '01',
            prod_fin: 'EX-TRANS35',
            prod_desc: 'EIXO DE TRANSMISSAO RANHURADO 35MM',
            mat_cod: 'MP-ACO4140-50',
            mat_desc: 'TARUGO ACO SAE 4140 DIAMETRO 50MM',
            tipo: 'MP',
            un: 'MT',
            op: '001',
            op_desc: 'Corte e Torneamento',
            qtd_nec: 15.750,
            qtd_disp: 80.000,
            qtd_fal: 0.000,
            status: 'RECEBIDO',
            crit: 'OK',
            fornec: 'GERDAU ACOSMINAS S/A'
        },
        {
            ped: '000002',
            it: '02',
            prod_fin: 'BU-BRONZE30',
            prod_desc: 'BUCHA AUTOLUBRIFICANTE BRONZE 30MM',
            mat_cod: 'MP-BRONZE-TM23',
            mat_desc: 'TUBO BRONZE TM-23 30X45MM X 1000',
            tipo: 'MP',
            un: 'MT',
            op: '001',
            op_desc: 'Usinagem de Buchas',
            qtd_nec: 25.000,
            qtd_disp: 45.000,
            qtd_fal: 0.000,
            status: 'SOLICITACAO',
            crit: 'ATENCAO',
            fornec: 'IBRAMETAL INDUSTRIA DE METAIS LTDA'
        }
    ];

    for (const n of necessidades) {
        await db.execute(`
            INSERT INTO app_material_necessidades (
                pedido, item_pedido, produto_final, produto_final_descricao,
                material_codigo, material_descricao, material_tipo, material_unidade,
                operacao, operacao_descricao, qtd_necessaria, qtd_disponivel, qtd_faltante,
                data_necessidade, dias_ate_necessidade, status_compra, criticidade,
                fornecedor, created_at, updated_at, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE() + INTERVAL 5 DAY, 5, ?, ?, ?, NOW(), NOW(), 1)
        `, [
            n.ped, n.it, n.prod_fin, n.prod_desc,
            n.mat_cod, n.mat_desc, n.tipo, n.un,
            n.op, n.op_desc, n.qtd_nec, n.qtd_disp, n.qtd_fal,
            n.status, n.crit, n.fornec
        ]);
    }
    console.log(`✅ ${necessidades.length} registros de necessidades de materiais injetados.`);

    // 7. SGQ / QUALIDADE (app_sgq_rncs)
    console.log('🛡️ Injetando Não-Conformidades da Qualidade (SGQ RNCs)...');
    await db.execute('DELETE FROM app_sgq_rncs WHERE IdEmpresa = 1');
    const rncs = [
        {
            num: 'RNC-2026-001',
            ped: '000003',
            op: '00000301',
            prod: 'EX-TRANS35',
            desc_prod: 'EIXO DE TRANSMISSAO RANHURADO 35MM',
            cliente: 'AGROMAQ MAQUINAS E EQUIPAMENTOS AGRICOLAS LTDA',
            recurso: 'TORNO-01',
            obs: 'Variação dimensional de 0.04mm acima da tolerância h7 no assentamento do rolamento.',
            status: 'em_analise',
            criado_por: 'Edson Manoel',
            limite: '2026-10-25'
        },
        {
            num: 'RNC-2026-002',
            ped: '000002',
            op: '00000201',
            prod: 'BU-BRONZE30',
            desc_prod: 'BUCHA AUTOLUBRIFICANTE BRONZE 30MM',
            cliente: 'METALURGICA PROGRESSO INDUSTRIAL S/A',
            recurso: 'USIN-02',
            obs: 'Rugosidade superficial elevada detectada no ensaio de rugosímetro.',
            status: 'concluida',
            criado_por: 'Edson Manoel',
            limite: '2026-10-20'
        }
    ];

    for (const r of rncs) {
        await db.execute(`
            INSERT INTO app_sgq_rncs (
                numero_rnc, pedido, op, produto, desc_produto, cliente,
                recurso_origem, observacao, status, criado_por, data_criacao,
                data_limite, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)
        `, [
            r.num, r.ped, r.op, r.prod, r.desc_prod, r.cliente,
            r.recurso, r.obs, r.status, r.criado_por, r.limite
        ]);
    }
    console.log(`✅ ${rncs.length} não-conformidades de qualidade (RNC) registradas.`);

    console.log('\n🎉 [SEED CONCLUÍDO COM SUCESSO] Todas as tabelas foram preenchidas com dados consistentes!');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ [SEED ERRO]:', err);
    process.exit(1);
});
