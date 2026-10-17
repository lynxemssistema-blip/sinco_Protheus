/**
 * tests/unit/erpValidation.test.js
 * Testes Unitários de Regras de Negócio e Validações do ERP (ErpValidator)
 * MODO DE AUTONOMIA TOTAL - SINCO PROTHEUS
 */

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const ErpValidator = require('../../server/services/erpValidationService');
const mysql = require('../../server/services/mysqlService');
const { MockData, VALID_CPFS, VALID_CNPJS } = require('../mocks/mockData');

after(() => {
    setTimeout(() => process.exit(0), 50);
});

describe('ERP Business Rules: ErpValidator.validarCliente', () => {
    it('deve aprovar clientes válidos no caminho feliz (com CNPJ válido)', () => {
        const cliente = MockData.clientes.caminhoFeliz[0];
        const res = ErpValidator.validarCliente(cliente);
        assert.strictEqual(res.valido, true, `Erros encontrados: ${res.erros.join(', ')}`);
        assert.strictEqual(res.erros.length, 0);
    });

    it('deve aprovar clientes válidos com CPF válido', () => {
        const cliente = MockData.clientes.caminhoFeliz[1];
        const res = ErpValidator.validarCliente(cliente);
        assert.strictEqual(res.valido, true, `Erros encontrados: ${res.erros.join(', ')}`);
        assert.strictEqual(res.erros.length, 0);
    });

    it('deve rejeitar objeto nulo ou indefinido graciosamente sem lançar exceção', () => {
        const res = ErpValidator.validarCliente(null);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.length > 0);
    });

    it('deve rejeitar razão social com menos de 3 caracteres ou vazia', () => {
        const c1 = { codigo: 'C01', razao_social: 'AB' };
        const res1 = ErpValidator.validarCliente(c1);
        assert.strictEqual(res1.valido, false);
        assert.ok(res1.erros.some(e => e.includes('Razão Social obrigatória')));

        const c2 = { codigo: 'C02', razao_social: '    ' };
        const res2 = ErpValidator.validarCliente(c2);
        assert.strictEqual(res2.valido, false);
    });

    it('deve rejeitar CPF inválido (dígitos verificadores errados e dígitos repetidos)', () => {
        const c1 = { razao_social: 'Empresa Teste', cnpj_cpf: '111.111.111-11' };
        const res1 = ErpValidator.validarCliente(c1);
        assert.strictEqual(res1.valido, false);
        assert.ok(res1.erros.some(e => e.includes('CPF inválido')));

        const c2 = { razao_social: 'Empresa Teste', cnpj_cpf: '123.456.789-00' };
        const res2 = ErpValidator.validarCliente(c2);
        assert.strictEqual(res2.valido, false);
        assert.ok(res2.erros.some(e => e.includes('CPF inválido')));
    });

    it('deve rejeitar CNPJ inválido (dígitos errados ou tamanho errado)', () => {
        const c1 = { razao_social: 'Empresa Teste', cnpj_cpf: '00.000.000/0000-00' };
        const res1 = ErpValidator.validarCliente(c1);
        assert.strictEqual(res1.valido, false);
        assert.ok(res1.erros.some(e => e.includes('CNPJ inválido')));

        const c2 = { razao_social: 'Empresa Teste', cnpj_cpf: '11.222.333/0001-99' };
        const res2 = ErpValidator.validarCliente(c2);
        assert.strictEqual(res2.valido, false);
        assert.ok(res2.erros.some(e => e.includes('CNPJ inválido')));
    });

    it('deve rejeitar formato de e-mail inválido', () => {
        const c1 = { razao_social: 'Empresa Teste', email: 'email_sem_arroba.com' };
        const res1 = ErpValidator.validarCliente(c1);
        assert.strictEqual(res1.valido, false);
        assert.ok(res1.erros.some(e => e.includes('E-mail informado possui formato inválido')));

        const c2 = { razao_social: 'Empresa Teste', email: 'email com espacos@dominio.com' };
        const res2 = ErpValidator.validarCliente(c2);
        assert.strictEqual(res2.valido, false);
    });

    it('deve lidar com dados numéricos para código sem quebrar (type coercion safe)', () => {
        const c = { codigo: 1042, razao_social: 'Metalúrgica Número LTDA' };
        const res = ErpValidator.validarCliente(c);
        assert.strictEqual(res.valido, true);
    });
});

describe('ERP Business Rules: ErpValidator.validarProduto', () => {
    it('deve aprovar produto válido no caminho feliz', () => {
        const prod = MockData.produtos.caminhoFeliz[0];
        const res = ErpValidator.validarProduto(prod);
        assert.strictEqual(res.valido, true);
        assert.strictEqual(res.erros.length, 0);
    });

    it('deve rejeitar produto nulo ou indefinido sem exceção não capturada', () => {
        const res = ErpValidator.validarProduto(null);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.length > 0);
    });

    it('deve rejeitar código de produto ausente ou com menos de 2 caracteres', () => {
        const p1 = { codigo: 'A', descricao: 'Parafuso M8' };
        const res1 = ErpValidator.validarProduto(p1);
        assert.strictEqual(res1.valido, false);
        assert.ok(res1.erros.some(e => e.includes('Código do produto obrigatório')));

        const p2 = { codigo: '', descricao: 'Parafuso M8' };
        const res2 = ErpValidator.validarProduto(p2);
        assert.strictEqual(res2.valido, false);
    });

    it('deve rejeitar descrição de produto ausente ou com menos de 2 caracteres', () => {
        const p1 = { codigo: 'PAR-01', descricao: 'P' };
        const res1 = ErpValidator.validarProduto(p1);
        assert.strictEqual(res1.valido, false);
        assert.ok(res1.erros.some(e => e.includes('Descrição do produto obrigatória')));
    });

    it('deve rejeitar peso líquido negativo', () => {
        const p = { codigo: 'PAR-01', descricao: 'Parafuso M8', peso_liquido: -0.5 };
        const res = ErpValidator.validarProduto(p);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('Peso líquido não pode ser negativo')));
    });

    it('deve rejeitar peso líquido inválido (NaN ou Infinity)', () => {
        const p1 = { codigo: 'PAR-01', descricao: 'Parafuso M8', peso_liquido: 'invalido' };
        const res1 = ErpValidator.validarProduto(p1);
        assert.strictEqual(res1.valido, false, 'Deveria rejeitar peso_liquido não numérico');

        const p2 = { codigo: 'PAR-01', descricao: 'Parafuso M8', peso_liquido: Infinity };
        const res2 = ErpValidator.validarProduto(p2);
        assert.strictEqual(res2.valido, false, 'Deveria rejeitar peso_liquido infinito');
    });
});

describe('ERP Business Rules: ErpValidator.validarOrdemProducao (MATA650)', () => {
    // Mock de conexão de banco para teste unitário sem I/O
    const mockConn = {
        async query(sql, params) {
            const code = params[params.length - 1];
            if (code === 'PAR-M8-50') {
                return [[{ codigo: 'PAR-M8-50', descricao: 'Parafuso M8', tipo: 'PA', status: 'ativo' }]];
            }
            if (code === 'BAR-INOX-8MM') {
                return [[{ codigo: 'BAR-INOX-8MM', descricao: 'Barra Inox', tipo: 'MP', status: 'ativo' }]];
            }
            if (code === 'INATIVO-01') {
                return [[{ codigo: 'INATIVO-01', descricao: 'Peça Obsoleta', tipo: 'PA', status: 'inativo' }]];
            }
            return [[]]; // Produto inexistente
        }
    };

    it('deve aprovar ordem de produção válida no caminho feliz', async () => {
        const op = {
            produto_codigo: 'PAR-M8-50',
            quantidade_planejada: 500,
            data_emissao: '2026-10-15',
            data_fim_prevista: '2026-10-20'
        };
        const res = await ErpValidator.validarOrdemProducao(op, mockConn);
        assert.strictEqual(res.valido, true, `Erros: ${res.erros.join(', ')}`);
        assert.strictEqual(res.erros.length, 0);
    });

    it('deve rejeitar OP se dados forem nulos ou vazios', async () => {
        const res = await ErpValidator.validarOrdemProducao(null, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.length > 0);
    });

    it('deve rejeitar OP se produto for matéria-prima (MP)', async () => {
        const op = {
            produto_codigo: 'BAR-INOX-8MM',
            quantidade_planejada: 100,
            data_emissao: '2026-10-15'
        };
        const res = await ErpValidator.validarOrdemProducao(op, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('é matéria-prima (tipo MP) e não pode ser fabricado')));
    });

    it('deve rejeitar OP se produto estiver inativo', async () => {
        const op = {
            produto_codigo: 'INATIVO-01',
            quantidade_planejada: 100,
            data_emissao: '2026-10-15'
        };
        const res = await ErpValidator.validarOrdemProducao(op, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('está inativo')));
    });

    it('deve rejeitar quantidade planejada zero, negativa ou não numérica', async () => {
        const opZero = { produto_codigo: 'PAR-M8-50', quantidade_planejada: 0, data_emissao: '2026-10-15' };
        const resZero = await ErpValidator.validarOrdemProducao(opZero, mockConn);
        assert.strictEqual(resZero.valido, false);

        const opNeg = { produto_codigo: 'PAR-M8-50', quantidade_planejada: -50, data_emissao: '2026-10-15' };
        const resNeg = await ErpValidator.validarOrdemProducao(opNeg, mockConn);
        assert.strictEqual(resNeg.valido, false);

        const opInf = { produto_codigo: 'PAR-M8-50', quantidade_planejada: Infinity, data_emissao: '2026-10-15' };
        const resInf = await ErpValidator.validarOrdemProducao(opInf, mockConn);
        assert.strictEqual(resInf.valido, false, 'Deveria rejeitar quantidade planejada Infinity');
    });

    it('deve rejeitar data prevista de conclusão anterior à emissão', async () => {
        const op = {
            produto_codigo: 'PAR-M8-50',
            quantidade_planejada: 100,
            data_emissao: '2026-10-20',
            data_fim_prevista: '2026-10-10'
        };
        const res = await ErpValidator.validarOrdemProducao(op, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('não pode ser anterior à data de emissão')));
    });

    it('deve rejeitar datas com formato corrompido ou inválido', async () => {
        const op = {
            produto_codigo: 'PAR-M8-50',
            quantidade_planejada: 100,
            data_emissao: 'data-invalida-123'
        };
        const res = await ErpValidator.validarOrdemProducao(op, mockConn);
        assert.strictEqual(res.valido, false, 'Deveria rejeitar data_emissao inválida');
    });
});

describe('ERP Business Rules: ErpValidator.validarPedidoVenda', () => {
    const mockConn = {
        async query(sql, params) {
            const queryStr = String(sql).toLowerCase();
            const param = params[params.length - 1];

            if (queryStr.includes('erp_clientes')) {
                if (param === 'CLI001') {
                    return [[{ codigo: 'CLI001', razao_social: 'Cliente Ativo', status: 'ativo' }]];
                }
                if (param === 'CLI_BLOQ') {
                    return [[{ codigo: 'CLI_BLOQ', razao_social: 'Cliente Bloqueado', status: 'bloqueado' }]];
                }
                return [[]]; // Cliente inexistente
            }

            if (queryStr.includes('erp_produtos')) {
                if (param === 'PAR-M8-50' || param === 'ARR-M8') {
                    return [[{ codigo: param, descricao: `Produto ${param}`, status: 'ativo' }]];
                }
                if (param === 'PROD_INAT') {
                    return [[{ codigo: 'PROD_INAT', descricao: 'Produto Inativo', status: 'inativo' }]];
                }
                return [[]]; // Produto inexistente
            }

            return [[]];
        }
    };

    it('deve aprovar pedido de venda válido no caminho feliz', async () => {
        const pedido = MockData.pedidosVenda.caminhoFeliz[0];
        const res = await ErpValidator.validarPedidoVenda(pedido.cabecalho, pedido.itens, mockConn);
        assert.strictEqual(res.valido, true, `Erros: ${res.erros.join(', ')}`);
        assert.strictEqual(res.erros.length, 0);
    });

    it('deve rejeitar cabeçalho ou itens nulos sem quebrar', async () => {
        const res1 = await ErpValidator.validarPedidoVenda(null, [], mockConn);
        assert.strictEqual(res1.valido, false);

        const res2 = await ErpValidator.validarPedidoVenda({ cliente_codigo: 'CLI001', data_emissao: '2026-10-15' }, null, mockConn);
        assert.strictEqual(res2.valido, false);
    });

    it('deve rejeitar pedido sem nenhum item (grid vazio)', async () => {
        const cab = { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' };
        const res = await ErpValidator.validarPedidoVenda(cab, [], mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('deve conter ao menos 1 item')));
    });

    it('deve rejeitar pedido para cliente bloqueado ou inativo', async () => {
        const cab = { cliente_codigo: 'CLI_BLOQ', data_emissao: '2026-10-15' };
        const itens = [{ produto_codigo: 'PAR-M8-50', quantidade: 10, preco_unitario: 5.0 }];
        const res = await ErpValidator.validarPedidoVenda(cab, itens, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('bloqueado para novas vendas')));
    });

    it('deve rejeitar item com produto inexistente ou inativo', async () => {
        const cab = { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' };
        const itens = [{ produto_codigo: 'PROD_INAT', quantidade: 10, preco_unitario: 5.0 }];
        const res = await ErpValidator.validarPedidoVenda(cab, itens, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('está inativo')));
    });

    it('deve rejeitar item com quantidade menor ou igual a zero', async () => {
        const cab = { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' };
        const itens = [{ produto_codigo: 'PAR-M8-50', quantidade: 0, preco_unitario: 5.0 }];
        const res = await ErpValidator.validarPedidoVenda(cab, itens, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('Quantidade deve ser maior que zero')));
    });

    it('deve rejeitar item com preço unitário negativo', async () => {
        const cab = { cliente_codigo: 'CLI001', data_emissao: '2026-10-15' };
        const itens = [{ produto_codigo: 'PAR-M8-50', quantidade: 10, preco_unitario: -2.50 }];
        const res = await ErpValidator.validarPedidoVenda(cab, itens, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('Preço unitário inválido')));
    });

    it('deve rejeitar item com data de entrega anterior à emissão', async () => {
        const cab = { cliente_codigo: 'CLI001', data_emissao: '2026-10-20' };
        const itens = [{
            produto_codigo: 'PAR-M8-50',
            quantidade: 10,
            preco_unitario: 2.50,
            data_entrega_prevista: '2026-10-10' // 10 dias antes da emissão!
        }];
        const res = await ErpValidator.validarPedidoVenda(cab, itens, mockConn);
        assert.strictEqual(res.valido, false);
        assert.ok(res.erros.some(e => e.includes('não pode ser anterior à data de emissão')));
    });
});
