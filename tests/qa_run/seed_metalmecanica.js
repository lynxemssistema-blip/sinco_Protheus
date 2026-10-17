/**
 * FASE 2 — Seed de Massa de Dados Industrial Realista & Multi-Tenant (SINCO PROTHEUS)
 * 
 * Criação idempotente de dados para a Banca de Auditoria:
 * - Tenant A (IdEmpresa = 100): QA Metalúrgica Alfa Ltda (Principal)
 * - Tenant B (IdEmpresa = 200): QA Usinagem Beta S/A (Vizinho Curioso - Testes de Invasão/Isolamento)
 * - 8 Clientes industriais, Matérias-primas, BOM multinível até 4 níveis,
 *   Roteiros (Laser, Dobra, Torno, Centro Usinagem, Solda, Zincagem, Pintura, Montagem),
 *   40 Pedidos de Venda, OPs em todos os status, RNCs, Romaneios, Usuários RBAC.
 * - Todos os dados possuem prefixo 'QA-'.
 * - Registra IDs criados em tests/qa_run/created_ids.json
 * - Gera tests/qa_run/esperados.json para confrontação na Fase 3.
 */

const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.resolve(__dirname, '..', '..', 'server');
require('dotenv').config({ path: path.join(SERVER_DIR, '.env') });
const db = require(path.join(SERVER_DIR, 'services', 'mysqlService'));
const bcrypt = require(path.join(SERVER_DIR, 'node_modules', 'bcrypt'));

const TENANT_A = 100;
const TENANT_B = 200;

async function runSeed() {
    console.log('🚀 [FASE 2 SEED] Iniciando injeção de massa de dados fictícia multi-tenant...');

    const createdIds = {
        empresas: [],
        usuarios: [],
        clientes: [],
        produtos: [],
        estruturas: [],
        recursos: [],
        setores: [],
        pedidos: [],
        ops: [],
        apontamentos: [],
        rncs: [],
        romaneios: []
    };

    // ── 0. LIMPEZA PRÉVIA IDEMPOTENTE ─────────────────────────────────────────
    console.log('🧹 Limpando dados anteriores de teste QA-...');
    const cleanTables = [
        'app_production_appointments', 'sc2010', 'sc6010', 'sc5010',
        'sg2010', 'sg1010', 'sb2010', 'sb1010', 'sa1010', 'sa2010',
        'app_sgq_rncs', 'app_romaneios', 'app_romaneio_items',
        'pcp_setor_recursos', 'pcp_recursos', 'pcp_setores', 'sh1010', 'usuario', 'empresa'
    ];

    for (const tbl of cleanTables) {
        try {
            await db.query(`DELETE FROM ${tbl} WHERE IdEmpresa IN (?, ?)`, [TENANT_A, TENANT_B]);
        } catch (e) {
            // Ignora se tabela não tiver IdEmpresa
        }
    }

    // ── 1. CRIAÇÃO DOS TENANTS (empresa) ──────────────────────────────────────
    console.log('🏢 Criando Tenants A e B...');
    await db.query(`
        INSERT INTO empresa (IdEmpresa, RazaoSocial, NomeFantasia, Segmento, Cnpj, Email, Telefone, plano, status_plano, CriadoEm, Deletado)
        VALUES 
        (?, 'QA Metalúrgica Alfa Ltda', 'QA Alfa Metalmecânica', 'Metalmecânica', '11222333000181', 'contato@qa-alfa.invalid', '(11) 4002-8922', 'enterprise', 'ativo', NOW(), 0),
        (?, 'QA Usinagem Beta S/A', 'QA Beta Usinagem', 'Usinagem CNC', '44555666000192', 'contato@qa-beta.invalid', '(11) 4002-8923', 'pro', 'ativo', NOW(), 0)
        ON DUPLICATE KEY UPDATE RazaoSocial = VALUES(RazaoSocial)
    `, [TENANT_A, TENANT_B]);
    createdIds.empresas.push(TENANT_A, TENANT_B);

    // ── 2. CRIAÇÃO DE USUÁRIOS POR TENANT (usuario) ───────────────────────────
    console.log('👥 Criando Usuários com diferentes perfis RBAC...');
    const hashedPass = await bcrypt.hash('qa123456', 10);
    const users = [
        // Tenant A
        { id: 1001, nome: 'QA Diretor Industrial', login: 'qa_diretor', funcao: 'Diretor Industrial', setor: 'Diretoria', empresa: TENANT_A, master: 1, tipo: 'admin' },
        { id: 1002, nome: 'QA Analista PCP Senior', login: 'qa_pcp', funcao: 'Analista PCP', setor: 'PCP', empresa: TENANT_A, master: 0, tipo: 'pcp' },
        { id: 1003, nome: 'QA Operador Laser', login: 'qa_operador_laser', funcao: 'Operador Laser', setor: 'Corte', empresa: TENANT_A, master: 0, tipo: 'operador' },
        { id: 1004, nome: 'QA Inspetor Qualidade', login: 'qa_qualidade', funcao: 'Inspetor SGQ', setor: 'Qualidade', empresa: TENANT_A, master: 0, tipo: 'qualidade' },
        { id: 1005, nome: 'QA Comprador Suprimentos', login: 'qa_compras', funcao: 'Comprador', setor: 'Suprimentos', empresa: TENANT_A, master: 0, tipo: 'comprador' },
        { id: 1006, nome: 'QA Faturista Comercial', login: 'qa_faturamento', funcao: 'Analista Faturamento', setor: 'Faturamento', empresa: TENANT_A, master: 0, tipo: 'faturamento' },
        { id: 1007, nome: 'QA Usuario Sem Financeiro', login: 'qa_sem_financeiro', funcao: 'Assistente', setor: 'Expedicao', empresa: TENANT_A, master: 0, tipo: 'leitura_restrita' },
        // Tenant B (O Vizinho Curioso)
        { id: 2001, nome: 'QA Admin Beta Usinagem', login: 'qa_beta_admin', funcao: 'Diretor Usinagem', setor: 'Diretoria', empresa: TENANT_B, master: 1, tipo: 'admin' },
        { id: 2002, nome: 'QA Operador Torno Beta', login: 'qa_beta_torno', funcao: 'Torneiro CNC', setor: 'Usinagem', empresa: TENANT_B, master: 0, tipo: 'operador' }
    ];

    for (const u of users) {
        await db.query(`
            INSERT INTO usuario (idUsuario, NomeCompleto, Login, Senha, Funcao, Setor, IdEmpresa, is_master, TipoUsuario, status, CriadoPor, DataCadastro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'A', 'QA-Seed', NOW())
            ON DUPLICATE KEY UPDATE NomeCompleto = VALUES(NomeCompleto), Senha = VALUES(Senha)
        `, [u.id, u.nome, u.login, hashedPass, u.funcao, u.setor, u.empresa, u.master, u.tipo]);
        createdIds.usuarios.push(u.id);
    }

    // ── 3. CLIENTES INDUSTRIAIS (sa1010) ──────────────────────────────────────
    console.log('🏭 Criando Clientes Industriais...');
    const clientesA = [
        { cod: 'QA0001', nome: 'QA FERROVIA BRASIL S/A', fantasia: 'QA VAGÕES & TRILHOS', cgc: '12345678000195', uf: 'SP', mun: 'CAMPINAS' },
        { cod: 'QA0002', nome: 'QA AGRO MAQUINAS COLHEITA LTDA', fantasia: 'QA AGRO IMPLEMENTOS', cgc: '23456789000106', uf: 'RS', mun: 'PASSO FUNDO' },
        { cod: 'QA0003', nome: 'QA TRATORES LINHA AMARELA S/A', fantasia: 'QA MINERAÇÃO EQUIPAMENTOS', cgc: '34567890000117', uf: 'MG', mun: 'CONTAGEM' },
        { cod: 'QA0004', nome: 'QA TURBINAS EOLICAS & ENERGIA', fantasia: 'QA ENERGIA RENOVAVEL', cgc: '45678901000128', uf: 'SC', mun: 'JOINVILLE' },
        { cod: 'QA0005', nome: 'QA AUTOPECAS TIER 1 BRASIL', fantasia: 'QA AUTO COMPONENTES', cgc: '56789012000139', uf: 'PR', mun: 'CURITIBA' },
        { cod: 'QA0006', nome: 'QA ARMAZENS GERAIS E CONSIGNADO', fantasia: 'QA CONSIGNADO ESTOQUE', cgc: '67890123000140', uf: 'SP', mun: 'SANTOS' },
        { cod: 'QA0007', nome: 'QA D\'AVILA & CIA CARGA PESADA', fantasia: 'QA D\'AVILA CARRETAS', cgc: '78901234000151', uf: 'RJ', mun: 'RESENDE' },
        { cod: 'QA0008', nome: 'QA ESTRUTURAS METALICAS SUL', fantasia: 'QA GALPOES MODULARES', cgc: '89012345000162', uf: 'RS', mun: 'CAXIAS DO SUL' }
    ];

    for (const c of clientesA) {
        await db.query(`
            INSERT INTO sa1010 (a1_filial, a1_cod, a1_loja, a1_nome, a1_nreduz, a1_cgc, a1_est, a1_mun, a1_tipo, d_e_l_e_t_, IdEmpresa)
            VALUES ('0101', ?, '01', ?, ?, ?, ?, ?, 'J', '', ?)
            ON DUPLICATE KEY UPDATE a1_nome = VALUES(a1_nome)
        `, [c.cod, c.nome, c.fantasia, c.cgc, c.uf, c.mun, TENANT_A]);
        createdIds.clientes.push(c.cod);
    }

    // Cliente exclusivo do Tenant B
    await db.query(`
        INSERT INTO sa1010 (a1_filial, a1_cod, a1_loja, a1_nome, a1_nreduz, a1_cgc, a1_est, a1_mun, a1_tipo, d_e_l_e_t_, IdEmpresa)
        VALUES ('0101', 'QA9001', '01', 'QA CLIENTE EXCLUSIVO BETA USINAGEM', 'QA BETA CLI', '99888777000166', 'SP', 'SOROCABA', 'J', '', ?)
        ON DUPLICATE KEY UPDATE a1_nome = VALUES(a1_nome)
    `, [TENANT_B]);
    createdIds.clientes.push('QA9001');

    // ── 4. MATÉRIAS-PRIMAS, COMPONENTES E PRODUTOS (sb1010 e sb2010) ───────────
    console.log('📦 Cadastrando Matérias-Primas e Produtos com Pesos e Estoque...');
    const produtos = [
        // Matérias-Primas (MP)
        { cod: 'QA-MP-CH-14', desc: 'CHAPA DE ACO CARBONO ASTM A36 1/4 (6.35MM)', tipo: 'MP', um: 'KG', peso: 50.0, prc: 7.80, estoque: 5400.0, loc: '01' },
        { cod: 'QA-MP-CH-38', desc: 'CHAPA DE ACO SAE 1020 3/8 (9.52MM)', tipo: 'MP', um: 'KG', peso: 75.0, prc: 8.20, estoque: 3200.0, loc: '01' },
        { cod: 'QA-MP-CH-IN', desc: 'CHAPA DE ACO INOXIDAVEL AISI 304 #14 (2.00MM)', tipo: 'MP', um: 'KG', peso: 16.0, prc: 32.50, estoque: 850.0, loc: '01' },
        { cod: 'QA-MP-BR-50', desc: 'BARRA REDONDA SAE 1020 TREFILADA 50MM', tipo: 'MP', um: 'KG', peso: 15.4, prc: 9.10, estoque: 1800.0, loc: '01' },
        { cod: 'QA-MP-TB-60', desc: 'TUBO ESTRUTURAL REDONDO 60MM X 3.0MM', tipo: 'MP', um: 'M', peso: 4.2, prc: 24.00, estoque: 650.0, loc: '01' },
        { cod: 'QA-CP-PF-M12', desc: 'PARAFUSO SEXTAVADO DIN 933 M12 X 40MM CL. 8.8', tipo: 'CP', um: 'PC', peso: 0.08, prc: 1.45, estoque: 12000.0, loc: '02' },
        { cod: 'QA-CP-PQ-M12', desc: 'PORCA SEXTAVADA AUTOTRAVANTE DIN 985 M12', tipo: 'CP', um: 'PC', peso: 0.03, prc: 0.65, estoque: 15000.0, loc: '02' },
        { cod: 'QA-MP-TT-PST', desc: 'TINTA EM PO POLIESTER PRETO FOSCO TEXTURIZADO', tipo: 'MP', um: 'KG', peso: 1.0, prc: 38.00, estoque: 350.0, loc: '01' },
        
        // Peças Cortadas/Dobradas/Usinadas (PI)
        { cod: 'QA-PC-201', desc: 'LATERAL DIREITA CORTE LASER E DOBRA CH 1/4', tipo: 'PI', um: 'PC', peso: 4.85, prc: 45.00, estoque: 120.0, loc: '03' },
        { cod: 'QA-PC-202', desc: 'PINO DE ARTICULACAO USINADO TORNO CNC 50MM', tipo: 'PI', um: 'PC', peso: 2.10, prc: 38.00, estoque: 80.0, loc: '03' },
        { cod: 'QA-PC-203', desc: 'BASE INFERIOR REFORÇADA CORTE LASER 3/8', tipo: 'PI', um: 'PC', peso: 8.40, prc: 82.00, estoque: 45.0, loc: '03' },
        { cod: 'QA-PC-204', desc: 'MANCAL GUIA BI-PARTIDO USINADO CNC', tipo: 'PI', um: 'PC', peso: 3.60, prc: 68.00, estoque: 30.0, loc: '03' },
        { cod: 'QA-PC-NEG', desc: 'PEÇA TESTE COM SALDO NEGATIVO PROPOSITAL', tipo: 'PI', um: 'PC', peso: 1.00, prc: 10.00, estoque: -15.0, loc: '03' }, // Edge Case Saldo Negativo

        // Subconjuntos Soldados / Terceirizados (PI)
        { cod: 'QA-SC-101', desc: 'SUBCONJUNTO CHASSI SOLDADO ESTRUTURAL', tipo: 'PI', um: 'PC', peso: 18.2, prc: 210.00, estoque: 25.0, loc: '03' },
        { cod: 'QA-SC-102', desc: 'FLANGE DE ENGATE RAPIDO COM ZINCAGEM TERCEIRIZADA', tipo: 'PI', um: 'PC', peso: 6.5, prc: 95.00, estoque: 60.0, loc: '03' },
        { cod: 'QA-FT-001', desc: 'KIT FANTASMA FIXAÇÃO E ACESSÓRIOS MONTAGEM', tipo: 'PI', um: 'CJ', peso: 0.5, prc: 12.00, estoque: 200.0, loc: '03' },

        // Produtos Acabados Multinível (PA)
        { cod: 'QA-SS-100', desc: 'SUPORTE SOLDADO PESADO ARTICULADO SERIE 100', tipo: 'PA', um: 'PC', peso: 28.5, prc: 480.00, estoque: 15.0, loc: '04' },
        { cod: 'QA-SS-200', desc: 'CONJUNTO VIGA GUIA MINERAÇÃO REFORÇADA 200', tipo: 'PA', um: 'PC', peso: 64.0, prc: 1250.00, estoque: 8.0, loc: '04' }
    ];

    for (const p of produtos) {
        await db.query(`
            INSERT INTO sb1010 (b1_filial, b1_cod, b1_desc, b1_tipo, b1_um, b1_peso, b1_pesbru, b1_prv1, b1_locpad, d_e_l_e_t_, IdEmpresa)
            VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
            ON DUPLICATE KEY UPDATE b1_desc = VALUES(b1_desc), b1_peso = VALUES(b1_peso), b1_prv1 = VALUES(b1_prv1)
        `, [p.cod, p.desc, p.tipo, p.um, p.peso, p.peso, p.prc, p.loc, TENANT_A]);

        await db.query(`
            INSERT INTO sb2010 (b2_filial, b2_cod, b2_local, b2_qatu, b2_vatu1, d_e_l_e_t_, IdEmpresa)
            VALUES ('0101', ?, ?, ?, ?, '', ?)
            ON DUPLICATE KEY UPDATE b2_qatu = VALUES(b2_qatu), b2_vatu1 = VALUES(b2_vatu1)
        `, [p.cod, p.loc, p.estoque, (p.estoque * p.prc), TENANT_A]);

        createdIds.produtos.push(p.cod);
    }

    // ── 5. ESTRUTURA DE PRODUTO / BOM MULTINÍVEL (sg1010) ─────────────────────
    console.log('🌲 Criando BOM Multinível até 4 Níveis com Fator de Perda...');
    const bomItems = [
        // Filhos diretos de QA-SS-100
        { pai: 'QA-SS-100', comp: 'QA-SC-101', qtd: 1.0, perda: 2.0 },
        { pai: 'QA-SS-100', comp: 'QA-SC-102', qtd: 1.0, perda: 0.0 },
        { pai: 'QA-SS-100', comp: 'QA-FT-001', qtd: 1.0, perda: 0.0 },
        { pai: 'QA-SS-100', comp: 'QA-MP-TT-PST', qtd: 1.5, perda: 5.0 },

        // Componentes de QA-SC-101
        { pai: 'QA-SC-101', comp: 'QA-PC-201', qtd: 2.0, perda: 3.0 },
        { pai: 'QA-SC-101', comp: 'QA-PC-202', qtd: 2.0, perda: 0.0 },

        // Componentes de QA-SC-102
        { pai: 'QA-SC-102', comp: 'QA-PC-203', qtd: 1.0, perda: 2.0 },

        // Componentes de QA-FT-001 (Kit Fixação - Onde é usado duplo)
        { pai: 'QA-FT-001', comp: 'QA-CP-PF-M12', qtd: 4.0, perda: 0.0 },
        { pai: 'QA-FT-001', comp: 'QA-CP-PQ-M12', qtd: 4.0, perda: 0.0 },

        // Matérias-Primas das Peças Individuais (Nível 3)
        { pai: 'QA-PC-201', comp: 'QA-MP-CH-14', qtd: 5.2, perda: 4.0 },
        { pai: 'QA-PC-202', comp: 'QA-MP-BR-50', qtd: 2.3, perda: 5.0 },
        { pai: 'QA-PC-203', comp: 'QA-MP-CH-38', qtd: 8.8, perda: 3.0 },

        // Segundo Pai utilizando o mesmo Kit Fantasma (Teste 'Onde é Usado')
        { pai: 'QA-SS-200', comp: 'QA-FT-001', qtd: 2.0, perda: 0.0 },
        { pai: 'QA-SS-200', comp: 'QA-PC-203', qtd: 2.0, perda: 0.0 },
        { pai: 'QA-SS-200', comp: 'QA-PC-204', qtd: 2.0, perda: 0.0 }
    ];

    for (const b of bomItems) {
        await db.query(`
            INSERT INTO sg1010 (g1_filial, g1_cod, g1_comp, g1_quant, g1_perda, g1_revini, g1_revfim, d_e_l_e_t_, IdEmpresa)
            VALUES ('0101', ?, ?, ?, ?, '01', '99', '', ?)
            ON DUPLICATE KEY UPDATE g1_quant = VALUES(g1_quant), g1_perda = VALUES(g1_perda)
        `, [b.pai, b.comp, b.qtd, b.perda, TENANT_A]);
        createdIds.estruturas.push(`${b.pai}->${b.comp}`);
    }

    // ── 6. SETORES E RECURSOS DE MÁQUINA (pcp_setores e pcp_recursos) ──────────
    console.log('⚙️ Criando Setores Fabris e Recursos de Máquina...');
    const setores = [
        { id: 101, codigo: 'CORTE', nome: 'Corte Laser / Puncionadeira' },
        { id: 102, codigo: 'DOBRA', nome: 'Dobra CNC' },
        { id: 103, codigo: 'USINAGEM', nome: 'Usinagem CNC (Torno e Centro)' },
        { id: 104, codigo: 'SOLDA', nome: 'Solda MIG / MAG' },
        { id: 105, codigo: 'BENEF', nome: 'Tratamento Superficial (Terceirizado)' },
        { id: 106, codigo: 'PINTURA', nome: 'Pintura Eletrostática a Pó' },
        { id: 107, codigo: 'MONTAGEM', nome: 'Montagem Final e Embalagem' }
    ];

    for (const s of setores) {
        await db.query(`
            INSERT INTO pcp_setores (id, nome, descricao, cor, ativo, IdEmpresa, criado_em)
            VALUES (?, ?, ?, '#1e293b', 1, ?, NOW())
            ON DUPLICATE KEY UPDATE nome = VALUES(nome), descricao = VALUES(descricao)
        `, [s.id, s.nome, s.codigo, TENANT_A]);
        createdIds.setores.push(s.codigo);
    }

    const recursos = [
        { id: 101, cod: 'REC-LASER01', nome: 'Laser Fibra Óptica 6kW Trumpf', setorId: 101, cap: 16.0 },
        { id: 102, cod: 'REC-DOBRA01', nome: 'Prensa Dobradeira CNC 160t', setorId: 102, cap: 16.0 },
        { id: 103, cod: 'REC-TORNO01', nome: 'Torno CNC Mazak Quick Turn', setorId: 103, cap: 16.0 },
        { id: 104, cod: 'REC-CENTRO01', nome: 'Centro de Usinagem Vertical Romi D800', setorId: 103, cap: 16.0 },
        { id: 105, cod: 'REC-SOLDA01', nome: 'Célula de Solda MIG/MAG Esab', setorId: 104, cap: 16.0 },
        { id: 106, cod: 'REC-TERC01', nome: 'Bicromatização e Zincagem Terceirizada', setorId: 105, cap: 24.0 },
        { id: 107, cod: 'REC-PINT01', nome: 'Linha Contínua de Pintura a Pó', setorId: 106, cap: 16.0 },
        { id: 108, cod: 'REC-MONT01', nome: 'Bancada de Montagem Estrutural', setorId: 107, cap: 16.0 }
    ];

    const [maxSh1] = await db.query('SELECT COALESCE(MAX(r_e_c_n_o_), 0) as m FROM sh1010');
    let recnoSh1 = (maxSh1[0]?.m || 0) + 1;
    for (const r of recursos) {
        await db.query(`
            INSERT INTO pcp_recursos (id, IdEmpresa, codigo, nome, tipo, capacidade_padrao, ativo, criado_em)
            VALUES (?, ?, ?, ?, 'MA', ?, 1, NOW())
            ON DUPLICATE KEY UPDATE nome = VALUES(nome), capacidade_padrao = VALUES(capacidade_padrao)
        `, [r.id, TENANT_A, r.cod, r.nome, r.cap]);

        await db.query(`
            INSERT INTO pcp_setor_recursos (setor_id, recurso_codigo, recurso_nome, IdEmpresa, criado_em)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE recurso_nome = VALUES(recurso_nome)
        `, [r.setorId, r.cod, r.nome, TENANT_A]);

        await db.query(`
            INSERT INTO sh1010 (h1_filial, h1_codigo, h1_descri, d_e_l_e_t_, r_e_c_n_o_, IdEmpresa)
            VALUES ('0101', ?, ?, '', ?, ?)
            ON DUPLICATE KEY UPDATE h1_descri = VALUES(h1_descri)
        `, [r.cod, r.nome, recnoSh1++, TENANT_A]);

        createdIds.recursos.push(r.cod);
    }

    // ── 7. ROTEIROS DE FABRICAÇÃO (sg2010 e sh1010) ───────────────────────────
    console.log('📋 Criando Operações de Roteiro com Setup e Tempo Unitário...');
    const roteiros = [
        { prod: 'QA-SS-100', op: '010', desc: 'SOLDA MIG CONJUNTO PRINCIPAL', rec: 'REC-SOLDA01', setup: 30, tempUn: 45 },
        { prod: 'QA-SS-100', op: '020', desc: 'PINTURA POLIESTER PRETO', rec: 'REC-PINT01', setup: 20, tempUn: 15 },
        { prod: 'QA-SS-100', op: '030', desc: 'MONTAGEM FINAL E INSPECAO', rec: 'REC-MONT01', setup: 15, tempUn: 25 },

        { prod: 'QA-PC-201', op: '010', desc: 'CORTE A LASER CH 1/4', rec: 'REC-LASER01', setup: 15, tempUn: 4.5 },
        { prod: 'QA-PC-201', op: '020', desc: 'DOBRA CNC 4 GOLPES', rec: 'REC-DOBRA01', setup: 20, tempUn: 6.0 },

        { prod: 'QA-PC-202', op: '010', desc: 'TORNEAMENTO CNC E ROSCA M12', rec: 'REC-TORNO01', setup: 45, tempUn: 12.0 },
        { prod: 'QA-PC-203', op: '010', desc: 'CORTE A LASER BASE 3/8', rec: 'REC-LASER01', setup: 15, tempUn: 8.0 },

        { prod: 'QA-SC-102', op: '010', desc: 'SOLDA BRACADEIRA', rec: 'REC-SOLDA01', setup: 15, tempUn: 18.0 },
        { prod: 'QA-SC-102', op: '020', desc: 'ZINCAGEM TERCEIRIZADA (REMESSA/RET)', rec: 'REC-TERC01', setup: 0, tempUn: 120.0 }
    ];

    for (const rot of roteiros) {
        await db.query(`
            INSERT INTO sg2010 (g2_filial, g2_codigo, g2_produto, g2_operac, g2_recurso, g2_descri, g2_setup, g2_tempad, d_e_l_e_t_, IdEmpresa)
            VALUES ('0101', '01', ?, ?, ?, ?, ?, ?, '', ?)
            ON DUPLICATE KEY UPDATE g2_descri = VALUES(g2_descri), g2_tempad = VALUES(g2_tempad)
        `, [rot.prod, rot.op, rot.rec, rot.desc, rot.setup, rot.tempUn, TENANT_A]);
    }

    // ── 8. CARTEIRA DE PEDIDOS DE VENDA (sc5010 e sc6010) — 40 PEDIDOS ────────
    console.log('📑 Gerando Carteira Realista de 40 Pedidos de Venda...');
    const hoje = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const fmtData = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

    let totalPedidosGerados = 0;
    const clientesPool = ['QA0001', 'QA0002', 'QA0003', 'QA0004', 'QA0005', 'QA0006', 'QA0007', 'QA0008'];

    for (let i = 1; i <= 40; i++) {
        const numPed = `QA${pad(i, 4)}`;
        const cliCod = clientesPool[(i - 1) % clientesPool.length];
        
        let diasOffset = 0;
        let statusPed = 'A';
        if (i <= 10) diasOffset = - (10 + i * 2);
        else if (i <= 20) diasOffset = (i - 15);
        else if (i <= 35) diasOffset = (10 + (i - 20) * 3);
        else if (i <= 38) diasOffset = 5;
        else if (i === 39) { diasOffset = 15; statusPed = 'C'; }
        else if (i === 40) diasOffset = 25;

        const dtEmissao = new Date(hoje);
        dtEmissao.setDate(dtEmissao.getDate() - 30);
        const dtEntrega = new Date(hoje);
        dtEntrega.setDate(dtEntrega.getDate() + diasOffset);

        const emissaoStr = fmtData(dtEmissao);
        const entregaStr = fmtData(dtEntrega);

        await db.query(`
            INSERT INTO sc5010 (c5_filial, c5_num, c5_tipo, c5_cliente, c5_lojacli, c5_emissao, c5_status, c5_mennota, d_e_l_e_t_, IdEmpresa)
            VALUES ('0101', ?, 'N', ?, '01', ?, ?, ?, '', ?)
            ON DUPLICATE KEY UPDATE c5_status = VALUES(c5_status)
        `, [numPed, cliCod, emissaoStr, statusPed, `Pedido Teste Auditoria QA #${i}`, TENANT_A]);

        createdIds.pedidos.push(numPed);

        const qtdItens = i === 40 ? 100 : (i % 3 === 0 ? 3 : (i % 2 === 0 ? 2 : 1));
        for (let it = 1; it <= qtdItens; it++) {
            const itemStr = pad(it, 2);
            const prodItem = (it % 2 === 0) ? 'QA-SS-200' : 'QA-SS-100';
            const qtdVen = (i * 2 + it * 5) % 80 + 10;
            const prcVen = prodItem === 'QA-SS-100' ? 480.00 : 1250.00;
            const valTotal = qtdVen * prcVen;

            let qtdEntregue = 0;
            if (i >= 36 && i <= 38 && it === 1) {
                qtdEntregue = Math.floor(qtdVen / 2);
            }

            await db.query(`
                INSERT INTO sc6010 (c6_filial, c6_num, c6_item, c6_produto, c6_qtdven, c6_prcven, c6_valor, c6_qtdent, c6_entreg, c6_cli, c6_loja, d_e_l_e_t_, IdEmpresa)
                VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, ?, ?, '01', '', ?)
                ON DUPLICATE KEY UPDATE c6_qtdven = VALUES(c6_qtdven), c6_valor = VALUES(c6_valor)
            `, [numPed, itemStr, prodItem, qtdVen, prcVen, valTotal, qtdEntregue, entregaStr, cliCod, TENANT_A]);
        }
        totalPedidosGerados++;
    }
    console.log(`✅ ${totalPedidosGerados} Pedidos de Venda cadastrados com sucesso.`);

    // ── 9. ORDENS DE PRODUÇÃO (sc2010) & APONTAMENTOS ─────────────────────────
    console.log('🏭 Gerando Ordens de Produção (Planejadas, Liberadas, Em Processo, Encerradas)...');
    const opsData = [
        { num: 'QA0001', it: '01', seq: '001', prod: 'QA-SS-100', qtd: 50, status: 'P', ped: 'QA0001' },
        { num: '006175', it: '01', seq: '001', prod: 'QA-SS-100', qtd: 40, status: 'L', ped: 'QA0002' },
        { num: 'QA0003', it: '01', seq: '001', prod: 'QA-SS-100', qtd: 30, status: 'E', ped: 'QA0003' },
        { num: 'QA0004', it: '01', seq: '001', prod: 'QA-PC-201', qtd: 100, status: 'F', ped: 'QA0004' },
        { num: 'QA0005', it: '01', seq: '001', prod: 'QA-SC-102', qtd: 20, status: 'E', ped: 'QA0005' },
        { num: 'QA0006', it: '01', seq: '001', prod: 'QA-SS-200', qtd: 15, status: 'L', ped: 'QA0006' },
        { num: 'QA0006', it: '01', seq: '002', prod: 'QA-SS-200', qtd: 15, status: 'P', ped: 'QA0006' }
    ];

    for (const op of opsData) {
        await db.query(`
            INSERT INTO sc2010 (c2_filial, c2_num, c2_item, c2_sequen, c2_produto, c2_quant, c2_status, c2_pedido, c2_itempv, c2_emissao, c2_datprf, d_e_l_e_t_, IdEmpresa)
            VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, '01', '20261001', '20261025', '', ?)
            ON DUPLICATE KEY UPDATE c2_quant = VALUES(c2_quant), c2_status = VALUES(c2_status), c2_itempv = '01'
        `, [op.num, op.it, op.seq, op.prod, op.qtd, op.status, op.ped, TENANT_A]);

        createdIds.ops.push(`${op.num}${op.it}${op.seq}`);
    }

    // Injetar apontamentos na OP 03 e OP 04
    console.log('🔨 Injetando Apontamentos Reais de Produção...');
    await db.query(`
        INSERT INTO app_production_appointments 
        (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo, usuario, quantidade, data_inicio, data_fim, observacao, conferencia_status, IdEmpresa, created_at)
        VALUES
        ('QA0003', '01', '001', '010', 'REC-SOLDA01', 'QA-SS-100', 'qa_operador_laser', 15, '2026-10-15 08:00:00', '2026-10-15 12:00:00', 'Apontamento parcial teste', 'APROVADO', ?, NOW()),
        ('QA0004', '01', '001', '010', 'REC-LASER01', 'QA-PC-201', 'qa_operador_laser', 100, '2026-10-14 07:30:00', '2026-10-14 11:30:00', 'Conclusão de lote corte', 'APROVADO', ?, NOW())
    `, [TENANT_A, TENANT_A]);

    // ── 10. QUALIDADE — RNCs (app_sgq_rncs) ────────────────────────────────────
    console.log('🛡️ Registrando Relatórios de Não Conformidade (RNCs)...');
    await db.query(`
        INSERT INTO app_sgq_rncs
        (numero_rnc, status, observacao, cliente, produto, desc_produto, criado_por, data_criacao, IdEmpresa)
        VALUES
        ('QA-RNC-001', 'ABERTA', 'Rebarba excessiva na furação da Lateral QA-PC-201 identificada pelo cliente', 'QA FERROVIA BRASIL S/A', 'QA-PC-201', 'LATERAL DIREITA CORTE LASER E DOBRA CH 1/4', 'QA Inspetor Qualidade', NOW(), ?),
        ('QA-RNC-002', 'EM_ANDAMENTO', 'Desvio angular de 2 graus na dobra 90º da chapa', 'QA AGRO MAQUINAS COLHEITA LTDA', 'QA-PC-201', 'LATERAL DIREITA CORTE LASER E DOBRA CH 1/4', 'QA Inspetor Qualidade', NOW(), ?),
        ('QA-RNC-003', 'ENCERRADA', 'Variação de espessura na chapa 1/4 Gerdau (medido 6.05mm)', 'GERDAU ACOSMINAS S/A', 'QA-MP-CH-14', 'CHAPA DE ACO CARBONO ASTM A36 1/4 (6.35MM)', 'QA Comprador Suprimentos', NOW(), ?)
    `, [TENANT_A, TENANT_A, TENANT_A]);
    createdIds.rncs.push('QA-RNC-001', 'QA-RNC-002', 'QA-RNC-003');

    // ── 11. LOGÍSTICA — ROMANEIOS (app_romaneios) ─────────────────────────────
    console.log('🚚 Criando Romaneio de Expedição e de Beneficiamento Terceirizado...');
    await db.query(`
        INSERT INTO app_romaneios
        (cliente_nome, status, peso_total, motorista_nome, veiculo_placa, observacao_geral, IdEmpresa, created_at)
        VALUES
        (?, 'EMITIDO', 1425.0, ?, 'ABC-1234', 'Romaneio Expedição Teste QA', ?, NOW()),
        (?, 'RETIRADO', 390.0, ?, 'XYZ-9876', 'Remessa Beneficiamento Terceirizado', ?, NOW())
    `, ['QA FERROVIA BRASIL S/A', 'Sebastiao D\'Avila', TENANT_A, 'ZINCAGEM INDUSTRIAL PAULISTA LTDA', 'Marcos Vinicius', TENANT_A]);
    createdIds.romaneios.push('QA-ROM-001', 'QA-ROM-002');

    // ── 12. GRAVAÇÃO DOS ARTEFATOS (created_ids.json e esperados.json) ────────
    const createdIdsPath = path.join(__dirname, 'created_ids.json');
    fs.writeFileSync(createdIdsPath, JSON.stringify(createdIds, null, 2), 'utf8');
    console.log(`💾 Registros criados salvos em: ${createdIdsPath}`);

    // Cálculo matemático prévio dos Valores Esperados para Confrontação na Fase 3
    const esperados = {
        metaGeral: {
            descricao: 'Valores calculados analiticamente a partir dos parâmetros de engenharia e pedidos',
            tenantPrincipal: TENANT_A,
            tenantVizinho: TENANT_B
        },
        calculosBOM: {
            produto: 'QA-SS-100',
            loteProducaoExemplo: 50,
            explosao: [
                { item: 'QA-SC-101', qtdPorPai: 1.0, perdaPercent: 2.0, qtdLiquida: 50.0, qtdTotalEsperada: 51.0 },
                { item: 'QA-PC-201', qtdPorPai: 2.0, perdaPercent: 3.0, qtdLiquida: 100.0, qtdTotalEsperada: 105.06 },
                { item: 'QA-MP-CH-14', qtdPorPai: 10.4, perdaPercent: 4.0, qtdLiquida: 520.0, qtdTotalEsperadaKg: 567.84 },
                { item: 'QA-PC-202', qtdPorPai: 2.0, perdaPercent: 0.0, qtdLiquida: 100.0, qtdTotalEsperada: 100.0 },
                { item: 'QA-CP-PF-M12', qtdPorPai: 4.0, perdaPercent: 0.0, qtdLiquida: 200.0, qtdTotalEsperada: 200.0 }
            ]
        },
        cargaMaquinaEsperadaHoras: {
            lote50Unidades_QA_SS_100: {
                laser_REC_LASER01: { setupMin: 15, unitarioMin: 4.5 * 105.06, totalHorasEsperado: 8.13 },
                dobra_REC_DOBRA01: { setupMin: 20, unitarioMin: 6.0 * 105.06, totalHorasEsperado: 10.84 },
                torno_REC_TORNO01: { setupMin: 45, unitarioMin: 12.0 * 100.0, totalHorasEsperado: 20.75 },
                solda_REC_SOLDA01: { setupMin: 30, unitarioMin: 45.0 * 50.0, totalHorasEsperado: 38.00 }
            }
        },
        carteiraVendasEsperada: {
            totalPedidos: 40,
            pedidosAtrasados: 10,
            pedidosVencendoEstaSemana: 10,
            pedidosFuturos: 15,
            pedidosParcialmenteFaturados: 3,
            pedidosCancelados: 1,
            pedidoEstresse100Itens: 'QA0040'
        },
        qualidade: {
            rncsAbertas: 2, // 1 aberta, 1 em andamento
            rncsEncerradas: 1
        },
        isolamentoMultiTenantEsperado: {
            tenantA_naoEnxerga: ['QA9001', 'QA Beta Usinagem', 'qa_beta_admin'],
            tenantB_naoEnxerga: ['QA0001', 'QA0002', 'QA-SS-100', 'QA0001', 'QA-RNC-001']
        }
    };

    const esperadosPath = path.join(__dirname, 'esperados.json');
    fs.writeFileSync(esperadosPath, JSON.stringify(esperados, null, 2), 'utf8');
    console.log(`🎯 Valores Esperados salvos em: ${esperadosPath}`);

    // Copiar também para a pasta datada 2026-10-17
    const datedDir = path.join(__dirname, '2026-10-17');
    if (fs.existsSync(datedDir)) {
        fs.copyFileSync(createdIdsPath, path.join(datedDir, 'created_ids.json'));
        fs.copyFileSync(esperadosPath, path.join(datedDir, 'esperados.json'));
    }

    console.log('\n======================================================');
    console.log('✅ FASE 2 CONCLUÍDA COM SUCESSO!');
    console.log(`• Tenants Criados: 2 (Tenant A: ${TENANT_A} | Tenant B: ${TENANT_B})`);
    console.log(`• Usuários RBAC: ${users.length} usuários em diferentes perfis`);
    console.log(`• Clientes Industriais: ${clientesA.length + 1}`);
    console.log(`• Produtos e Matérias-Primas: ${produtos.length} itens com saldo SB2010`);
    console.log(`• Relações BOM Multinível: ${bomItems.length} ramificações`);
    console.log(`• Pedidos de Venda: ${totalPedidosGerados} pedidos distribuídos`);
    console.log(`• Ordens de Produção: ${opsData.length} OPs com status variados`);
    console.log(`• RNCs: 3 registros | Romaneios: 2 registros`);
    console.log('======================================================\n');
    process.exit(0);
}

runSeed().catch(err => {
    console.error('❌ Falha na injeção da massa de dados:', err);
    process.exit(1);
});
