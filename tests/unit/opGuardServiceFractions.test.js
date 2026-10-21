/**
 * tests/unit/opGuardServiceFractions.test.js
 * Saldo por fração PCP no apontamento — Etapa 2 (server/services/opGuardService.js).
 * Usa bancos falsos em memória: nenhuma conexão com o MySQL/Postgres real.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

require.cache[path.join(__dirname, '../../server/services/mysqlService.js')] = {
    id: 'mysqlService', filename: 'mysqlService', loaded: true,
    exports: { query: async () => [[]] }
};

const guard = require('../../server/services/opGuardService');

// Postgres indisponível: rejeita na hora (sem esperar os 1500ms do timeout de corrida)
const dbIndisponivel = { query: async () => { throw new Error('PG indisponível neste teste'); } };

// Conexão falsa: casa cada SQL com o primeiro padrão que bater (mais específico primeiro)
const criarConn = (handlers) => ({
    query: async (sql) => {
        for (const [padrao, valor] of handlers) {
            if (padrao.test(sql)) {
                if (valor instanceof Error) throw valor;
                return [valor];
            }
        }
        return [/SUM\(/i.test(sql) ? [{ total: 0 }] : []];
    }
});

describe('opGuardService: resolvePedidoItemFromOp', () => {
    it('deve achar o pedido/item pela OP no Protheus (sc2010)', async () => {
        const conn = criarConn([[/c2_pedido/i, [{ pedido: '000003', item: '02' }]]]);
        assert.deepStrictEqual(await guard.resolvePedidoItemFromOp(conn, '00000302', '02'), { pedido: '000003', item: '02' });
    });

    it('sem registro em nenhuma tabela retorna null (apontamento de OP fora de pedido de venda)', async () => {
        assert.strictEqual(await guard.resolvePedidoItemFromOp(criarConn([]), '900001', '01'), null);
    });
});

describe('opGuardService: getFractionBalances', () => {
    it('item com uma só programação não é fracionado', async () => {
        const conn = criarConn([
            [/c2_pedido/i, [{ pedido: '000003', item: '02' }]],
            [/app_pcp_delivery_forecasts/i, [{ id: 1, numero_lote: null, quantidade_pcp: 100, data_entrega_pcp: '2026-11-01' }]]
        ]);
        const r = await guard.getFractionBalances(conn, dbIndisponivel, { op_numero: '00000302', op_item: '02' });
        assert.deepStrictEqual(r, { pedido: '000003', item: '02', fracionado: false, fractions: [] });
    });

    it('deve ratear o planejado da operação entre as frações e descontar o já apontado de cada uma', async () => {
        const apontadoPorFracao = { AA: 10, AB: 5 };
        const conn = criarConn([
            [/c2_pedido/i, [{ pedido: '000003', item: '02' }]],
            [/app_pcp_delivery_forecasts/i, [
                { id: 501, numero_lote: 'AA', quantidade_pcp: 60, data_entrega_pcp: '2026-10-20' },
                { id: 502, numero_lote: 'AB', quantidade_pcp: 40, data_entrega_pcp: '2026-11-10' }
            ]],
            [/c2_quant/i, [{ qtd_planejada: 100 }]]
        ]);
        // A fração só aparece nos parâmetros (não no SQL), então captura o total certo por fração via wrapper
        const originalQuery = conn.query.bind(conn);
        conn.query = async (sql, params) => {
            if (/app_production_appointments/i.test(sql)) {
                const fracao = params[params.length - 1];
                return [[{ total: apontadoPorFracao[fracao] || 0 }]];
            }
            return originalQuery(sql, params);
        };

        const r = await guard.getFractionBalances(conn, dbIndisponivel, { op_numero: '00000302', op_item: '02', op_sequencia: '001', operacao_codigo: '10' });
        assert.strictEqual(r.fracionado, true);
        assert.strictEqual(r.fractions.length, 2);

        const aa = r.fractions.find(f => f.numero_lote === 'AA');
        assert.strictEqual(aa.planejado, 60); // 100 * (60/100)
        assert.strictEqual(aa.apontado, 10);
        assert.strictEqual(aa.saldo, 50);

        const ab = r.fractions.find(f => f.numero_lote === 'AB');
        assert.strictEqual(ab.planejado, 40); // 100 * (40/100)
        assert.strictEqual(ab.apontado, 5);
        assert.strictEqual(ab.saldo, 35);
    });

    it('sem operacao_codigo retorna só as frações, sem saldo calculado (não faz a query de apontamento)', async () => {
        const conn = criarConn([
            [/c2_pedido/i, [{ pedido: '000003', item: '02' }]],
            [/app_pcp_delivery_forecasts/i, [
                { id: 501, numero_lote: 'AA', quantidade_pcp: 60 },
                { id: 502, numero_lote: 'AB', quantidade_pcp: 40 }
            ]]
        ]);
        const r = await guard.getFractionBalances(conn, dbIndisponivel, { op_numero: '00000302', op_item: '02' });
        assert.strictEqual(r.fracionado, true);
        r.fractions.forEach(f => {
            assert.strictEqual(f.planejado, null);
            assert.strictEqual(f.apontado, null);
            assert.strictEqual(f.saldo, null);
        });
    });
});
