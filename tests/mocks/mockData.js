/**
 * tests/mocks/mockData.js
 * Fábrica de Mocks e Cenários de Teste (Caminho Feliz + Edge Cases)
 * MODO DE AUTONOMIA TOTAL - SINCO PROTHEUS
 */

// Helper para gerar strings de tamanho arbitrário (buffer overflow tests)
const generateLongString = (length, char = 'A') => char.repeat(length);

// CPF e CNPJ válidos (com dígitos verificadores reais pela regra Receita Federal)
const VALID_CPFS = [
    '52998224725', // Válido matematicamente
    '15350946056', // Válido matematicamente
    '81177651037'  // Válido matematicamente
];

const VALID_CNPJS = [
    '11222333000181', // Válido matematicamente
    '19307785000178', // Válido matematicamente
    '00000000000191'  // Válido matematicamente
];

// Dados Mock do Sistema
const MockData = {
    // 1. CLIENTES
    clientes: {
        caminhoFeliz: [
            {
                codigo: 'CLI001',
                razao_social: 'Delta Parafusos e Fixadores LTDA',
                nome_fantasia: 'Delta Parafusos',
                cnpj_cpf: '11.222.333/0001-81',
                email: 'contato@deltaparafusos.com.br',
                telefone: '1133334444',
                status: 'ativo'
            },
            {
                codigo: 'CLI002',
                razao_social: 'João Silva Engenharia ME',
                nome_fantasia: 'Silva Eng',
                cnpj_cpf: '529.982.247-25',
                email: 'joao.silva@engenharia.com',
                status: 'ativo'
            }
        ],
        edgeCases: [
            {
                name: 'Cliente nulo/vazio',
                data: null,
                expectedError: true
            },
            {
                name: 'Razão social muito curta (< 3 caracteres)',
                data: { codigo: 'CLI003', razao_social: 'AB', cnpj_cpf: '11222333000181' },
                expectedError: true
            },
            {
                name: 'Razão social apenas espaços em branco',
                data: { codigo: 'CLI004', razao_social: '     ', cnpj_cpf: '11222333000181' },
                expectedError: true
            },
            {
                name: 'Código de cliente numérico sem conversão para string',
                data: { codigo: 9999, razao_social: 'Metalúrgica Express LTDA' },
                expectedError: false // Deve ser sanitizado sem quebrar
            },
            {
                name: 'CPF com dígitos repetidos (ex: 111.111.111-11)',
                data: { codigo: 'CLI005', razao_social: 'Teste Repetido', cnpj_cpf: '111.111.111-11' },
                expectedError: true
            },
            {
                name: 'CPF com dígito verificador incorreto',
                data: { codigo: 'CLI006', razao_social: 'Cliente CPF Inválido', cnpj_cpf: '123.456.789-00' },
                expectedError: true
            },
            {
                name: 'CNPJ com dígito verificador incorreto',
                data: { codigo: 'CLI007', razao_social: 'Empresa CNPJ Inválido', cnpj_cpf: '11.222.333/0001-00' },
                expectedError: true
            },
            {
                name: 'Documento com tamanho inválido (nem 11 nem 14)',
                data: { codigo: 'CLI008', razao_social: 'Cliente Documento Incompleto', cnpj_cpf: '12345678' },
                expectedError: true
            },
            {
                name: 'E-mail malformado sem arroba',
                data: { codigo: 'CLI009', razao_social: 'Cliente Email Invalido', email: 'contato.empresa.com.br' },
                expectedError: true
            },
            {
                name: 'E-mail com espaços no meio',
                data: { codigo: 'CLI010', razao_social: 'Cliente Email Espacos', email: 'contato @empresa.com' },
                expectedError: true
            },
            {
                name: 'Estouro de limite de caracteres (5000 chars na Razão Social)',
                data: { codigo: 'CLI011', razao_social: generateLongString(5000, 'X'), email: 'valid@corp.com' },
                expectedError: false // Deve truncar ou aceitar com segurança
            }
        ]
    },

    // 2. PRODUTOS
    produtos: {
        caminhoFeliz: [
            {
                codigo: 'PAR-M8-50',
                descricao: 'Parafuso Sextavado M8 x 50mm Inox 304',
                tipo: 'PA',
                unidade_medida: 'PC',
                peso_liquido: 0.045,
                status: 'ativo'
            },
            {
                codigo: 'ARR-M8',
                descricao: 'Arruela Lisa M8 Aço Inox',
                tipo: 'PI',
                unidade_medida: 'PC',
                peso_liquido: 0.008,
                status: 'ativo'
            },
            {
                codigo: 'BAR-INOX-8MM',
                descricao: 'Barra Redonda Inox 304 8mm (Matéria-Prima)',
                tipo: 'MP',
                unidade_medida: 'KG',
                peso_liquido: 1.000,
                status: 'ativo'
            }
        ],
        edgeCases: [
            {
                name: 'Produto nulo',
                data: null,
                expectedError: true
            },
            {
                name: 'Código de produto com 1 caractere',
                data: { codigo: 'A', descricao: 'Parafuso Miniatura' },
                expectedError: true
            },
            {
                name: 'Código de produto ausente',
                data: { codigo: '', descricao: 'Sem Código' },
                expectedError: true
            },
            {
                name: 'Descrição de produto ausente',
                data: { codigo: 'PROD999', descricao: '' },
                expectedError: true
            },
            {
                name: 'Peso líquido negativo',
                data: { codigo: 'PROD-NEG', descricao: 'Produto com peso negativo', peso_liquido: -12.5 },
                expectedError: true
            },
            {
                name: 'Peso líquido como string não numérica ("abc")',
                data: { codigo: 'PROD-NAN', descricao: 'Produto com peso NaN', peso_liquido: 'abc' },
                expectedError: true
            },
            {
                name: 'Peso líquido como Infinity',
                data: { codigo: 'PROD-INF', descricao: 'Produto com peso infinito', peso_liquido: Infinity },
                expectedError: true
            }
        ]
    },

    // 3. ORDENS DE PRODUÇÃO
    ordensProducao: {
        caminhoFeliz: [
            {
                numero_op: '00000101001',
                produto_codigo: 'PAR-M8-50',
                quantidade_planejada: 1000,
                data_emissao: '2026-10-15',
                data_inicio_prevista: '2026-10-16',
                data_fim_prevista: '2026-10-20',
                pedido_venda: 'PED001',
                item_pedido: '01'
            }
        ],
        edgeCases: [
            {
                name: 'OP com produto vazio',
                data: { numero_op: 'OP-TEST', produto_codigo: '', quantidade_planejada: 100, data_emissao: '2026-10-15' },
                expectedError: true
            },
            {
                name: 'OP com quantidade zero',
                data: { numero_op: 'OP-TEST', produto_codigo: 'PAR-M8-50', quantidade_planejada: 0, data_emissao: '2026-10-15' },
                expectedError: true
            },
            {
                name: 'OP com quantidade negativa',
                data: { numero_op: 'OP-TEST', produto_codigo: 'PAR-M8-50', quantidade_planejada: -500, data_emissao: '2026-10-15' },
                expectedError: true
            },
            {
                name: 'OP com quantidade Infinity',
                data: { numero_op: 'OP-TEST', produto_codigo: 'PAR-M8-50', quantidade_planejada: Infinity, data_emissao: '2026-10-15' },
                expectedError: true
            },
            {
                name: 'OP sem data de emissão',
                data: { numero_op: 'OP-TEST', produto_codigo: 'PAR-M8-50', quantidade_planejada: 100 },
                expectedError: true
            },
            {
                name: 'OP com data de término anterior à emissão',
                data: {
                    numero_op: 'OP-TEST',
                    produto_codigo: 'PAR-M8-50',
                    quantidade_planejada: 100,
                    data_emissao: '2026-10-20',
                    data_fim_prevista: '2026-10-10' // Anterior!
                },
                expectedError: true
            },
            {
                name: 'OP com data inválida (formato corrompido)',
                data: {
                    numero_op: 'OP-TEST',
                    produto_codigo: 'PAR-M8-50',
                    quantidade_planejada: 100,
                    data_emissao: 'data-invalida'
                },
                expectedError: true
            }
        ]
    },

    // 4. PEDIDOS DE VENDA
    pedidosVenda: {
        caminhoFeliz: [
            {
                cabecalho: {
                    numero: 'PV2026-001',
                    cliente_codigo: 'CLI001',
                    data_emissao: '2026-10-15',
                    condicao_pagamento: '30DD',
                    observacao: 'Pedido padrão com entrega programada'
                },
                itens: [
                    {
                        produto_codigo: 'PAR-M8-50',
                        quantidade: 500,
                        preco_unitario: 1.85,
                        data_entrega_prevista: '2026-10-25'
                    },
                    {
                        produto_codigo: 'ARR-M8',
                        quantidade: 1000,
                        preco_unitario: 0.35,
                        data_entrega_prevista: '2026-10-25'
                    }
                ]
            }
        ],
        edgeCases: [
            {
                name: 'Pedido sem itens (array vazio)',
                cabecalho: { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' },
                itens: [],
                expectedError: true
            },
            {
                name: 'Pedido com itens nulos',
                cabecalho: { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' },
                itens: null,
                expectedError: true
            },
            {
                name: 'Pedido sem cliente informado',
                cabecalho: { cliente_codigo: '', data_emissao: '2026-10-15' },
                itens: [{ produto_codigo: 'PAR-M8-50', quantidade: 10, preco_unitario: 1.0 }],
                expectedError: true
            },
            {
                name: 'Item com quantidade zero',
                cabecalho: { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' },
                itens: [{ produto_codigo: 'PAR-M8-50', quantidade: 0, preco_unitario: 1.0 }],
                expectedError: true
            },
            {
                name: 'Item com quantidade negativa',
                cabecalho: { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' },
                itens: [{ produto_codigo: 'PAR-M8-50', quantidade: -20, preco_unitario: 1.0 }],
                expectedError: true
            },
            {
                name: 'Item com preço unitário negativo',
                cabecalho: { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' },
                itens: [{ produto_codigo: 'PAR-M8-50', quantidade: 10, preco_unitario: -5.0 }],
                expectedError: true
            },
            {
                name: 'Item com data de entrega anterior à emissão do pedido',
                cabecalho: { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' },
                itens: [{
                    produto_codigo: 'PAR-M8-50',
                    quantidade: 10,
                    preco_unitario: 1.0,
                    data_entrega_prevista: '2026-10-01' // 14 dias antes!
                }],
                expectedError: true
            }
        ]
    },

    // 5. APONTAMENTOS DE PRODUÇÃO (SHOPFLOOR)
    apontamentos: {
        cenarios: [
            {
                name: 'Conclusão total da OP (1000 previstas, 1000 produzidas)',
                prevista: 1000,
                produzida: 1000,
                refugo: 0,
                expectedStatus: 'CONCLUIDO'
            },
            {
                name: 'Superprodução (1000 previstas, 1100 produzidas)',
                prevista: 1000,
                produzida: 1100,
                refugo: 10,
                expectedStatus: 'CONCLUIDO'
            },
            {
                name: 'Produção parcial em andamento (1000 previstas, 400 produzidas)',
                prevista: 1000,
                produzida: 400,
                refugo: 5,
                expectedStatus: 'EM_ANDAMENTO'
            },
            {
                name: 'OP pendente (1000 previstas, 0 produzidas)',
                prevista: 1000,
                produzida: 0,
                refugo: 0,
                expectedStatus: 'PENDENTE'
            },
            {
                name: 'Refugo puro sem peças boas (0 boas, 50 refugadas)',
                prevista: 1000,
                produzida: 0,
                refugo: 50,
                expectedStatus: 'PENDENTE'
            }
        ]
    }
};

module.exports = {
    MockData,
    VALID_CPFS,
    VALID_CNPJS,
    generateLongString
};
