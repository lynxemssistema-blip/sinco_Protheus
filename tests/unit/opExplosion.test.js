/**
 * tests/unit/opExplosion.test.js
 * Testes Unitários do Motor de Explosão e Ciclo Completo de OP (server/services/opExplosionService.js)
 * MODO DE AUTONOMIA TOTAL - SINCO PROTHEUS
 */

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const { explodirOrdemProducao, fetchProductBom, fetchProductRouting } = require('../../server/services/opExplosionService');

after(() => {
    setTimeout(() => process.exit(0), 50);
});

describe('OP Explosion Engine: Edge cases e Validação de Parâmetros', () => {
    it('deve rejeitar explosão se número da OP for vazio ou nulo', async () => {
        const res = await explodirOrdemProducao({ numero_op: '', produto_codigo: 'PAR-M8-50', quantidade: 100 });
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.error, 'Parâmetros inválidos');
    });

    it('deve rejeitar explosão se código do produto for vazio ou nulo', async () => {
        const res = await explodirOrdemProducao({ numero_op: '00000101001', produto_codigo: '', quantidade: 100 });
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.error, 'Parâmetros inválidos');
    });

    it('deve rejeitar explosão se quantidade for menor ou igual a zero', async () => {
        const resZero = await explodirOrdemProducao({ numero_op: '00000101001', produto_codigo: 'PAR-M8-50', quantidade: 0 });
        assert.strictEqual(resZero.success, false);

        const resNeg = await explodirOrdemProducao({ numero_op: '00000101001', produto_codigo: 'PAR-M8-50', quantidade: -50 });
        assert.strictEqual(resNeg.success, false);

        const resNaN = await explodirOrdemProducao({ numero_op: '00000101001', produto_codigo: 'PAR-M8-50', quantidade: 'abc' });
        assert.strictEqual(resNaN.success, false);
    });

    it('deve retornar array vazio se código do produto for vazio em fetchProductBom e fetchProductRouting', async () => {
        const bomVazia = await fetchProductBom('');
        assert.deepStrictEqual(bomVazia, []);

        const roteiroVazio = await fetchProductRouting('');
        assert.deepStrictEqual(roteiroVazio, []);
    });
});

describe('OP Explosion Engine: Ciclo Completo com Mock Client', () => {
    // Mock de banco in-memory para simular todas as tabelas industriais
    const createMockClient = () => {
        const state = {
            deletedMaterials: [],
            deletedOps: [],
            insertedMaterials: [],
            insertedOperations: [],
            subOps: []
        };

        const mockClient = {
            state,
            async query(sql, params) {
                const queryStr = String(sql).toLowerCase();

                // Tratamento de DELETE (limpeza idempotente)
                if (queryStr.includes('delete from')) {
                    return [{ affectedRows: 0 }];
                }

                // Busca BOM no MySQL (erp_estruturas_bom)
                if (queryStr.includes('erp_estruturas_bom')) {
                    const parent = params[0];
                    if (parent === 'CONJUNTO-01') {
                        return [[
                            {
                                produto_pai_codigo: 'CONJUNTO-01',
                                componente: 'SEMI-01',
                                descricao: 'Subconjunto Usinado',
                                tipo: 'PI',
                                unidade: 'PC',
                                qtd_base: 2,
                                perda_percentual: 5
                            },
                            {
                                produto_pai_codigo: 'CONJUNTO-01',
                                componente: 'PARAFUSO-M8',
                                descricao: 'Parafuso Fixador',
                                tipo: 'MP',
                                unidade: 'PC',
                                qtd_base: 4,
                                perda_percentual: 0
                            }
                        ]];
                    }
                    if (parent === 'SEMI-01') {
                        return [[
                            {
                                produto_pai_codigo: 'SEMI-01',
                                componente: 'BARRA-REDONDA',
                                descricao: 'Barra de Aço 1020',
                                tipo: 'MP',
                                unidade: 'KG',
                                qtd_base: 0.5,
                                perda_percentual: 10
                            }
                        ]];
                    }
                    return [[]]; // Sem estrutura
                }

                // Fallback sg1010
                if (queryStr.includes('sg1010')) {
                    return [[]];
                }

                // Busca Roteiro de Operações no MySQL (erp_roteiros_operacoes)
                if (queryStr.includes('erp_roteiros_operacoes')) {
                    const prod = params[0];
                    if (prod === 'CONJUNTO-01') {
                        return [[
                            {
                                operacao_seq: '001',
                                codigo_recurso: 'MONT-01',
                                descricao_operacao: 'Montagem Final',
                                tempo_setup_minutos: 15,
                                tempo_operacao_minutos: 2
                            }
                        ]];
                    }
                    if (prod === 'SEMI-01') {
                        return [[
                            {
                                operacao_seq: '001',
                                codigo_recurso: 'TORNO-01',
                                descricao_operacao: 'Torneamento CNC',
                                tempo_setup_minutos: 30,
                                tempo_operacao_minutos: 5
                            }
                        ]];
                    }
                    return [[]];
                }

                if (queryStr.includes('sg2010')) {
                    return [[]];
                }

                // INSERT em erp_ordens_producao_materiais
                if (queryStr.includes('insert into erp_ordens_producao_materiais')) {
                    state.insertedMaterials.push(params);
                    return [{ affectedRows: 1 }];
                }

                // INSERT em erp_ordens_producao_operacoes
                if (queryStr.includes('insert into erp_ordens_producao_operacoes')) {
                    state.insertedOperations.push(params);
                    return [{ affectedRows: 1 }];
                }

                // INSERT Sub-OP em erp_ordens_producao
                if (queryStr.includes('erp_ordens_producao') && queryStr.includes('op_pai')) {
                    state.subOps.push(params);
                    return [{ affectedRows: 1 }];
                }

                // Count de materiais
                if (queryStr.includes('count(*)') && queryStr.includes('erp_ordens_producao_materiais')) {
                    return [[{ total: state.insertedMaterials.length }]];
                }

                return [{ affectedRows: 1 }];
            }
        };

        return mockClient;
    };

    it('deve explodir estrutura multi-nível e calcular perda percentual e tempos operacionais', async () => {
        const mockClient = createMockClient();

        const res = await explodirOrdemProducao({
            numero_op: '000100',
            produto_codigo: 'CONJUNTO-01',
            quantidade: 10,
            conn: mockClient
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.total_operacoes, 1, 'OP principal deve ter 1 operação montada');
        assert.strictEqual(res.sub_ops.length, 1, 'Deve gerar 1 Sub-OP para SEMI-01');
        assert.strictEqual(res.sub_ops[0].produto_codigo, 'SEMI-01');

        // Qtd necessária SEMI-01 = 2 (qtd_base) * 10 (OP) * 1.05 (5% perda) = 21
        assert.strictEqual(res.sub_ops[0].quantidade, 21);

        // Operação da OP principal: setup=15 + (10 * 2) = 35 minutos
        const opPrincipal = mockClient.state.insertedOperations[0];
        const tempoTotal = opPrincipal[7];
        assert.strictEqual(tempoTotal, 35, 'Tempo total de operação principal incorreto');
    });

    it('deve suportar produtos sem BOM gerando 0 materiais sem falha', async () => {
        const mockClient = createMockClient();

        const res = await explodirOrdemProducao({
            numero_op: '000200',
            produto_codigo: 'PROD_SEM_BOM',
            quantidade: 50,
            conn: mockClient
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.total_materiais, 0);
        assert.strictEqual(res.sub_ops.length, 0);
    });
});
